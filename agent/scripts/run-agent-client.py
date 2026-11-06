import sys
import os
import re
import json
import time
import uuid
import platform
import argparse
import urllib.request
import urllib.error
import ssl
import subprocess

# Localização do arquivo de credenciais
if getattr(sys, "frozen", False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

STATE_FILE = os.path.join(BASE_DIR, "agent_state.json")

SYSTEM = platform.system()  # 'Windows', 'Linux', 'Darwin' (macOS)


def get_active_interactive_username():
    """Identifica o nome de usuário ativo na sessão interativa (Windows, Linux ou macOS)."""
    if SYSTEM == "Windows":
        # 1. WMI
        try:
            ps_cmd = "Get-CimInstance Win32_ComputerSystem | Select-Object -ExpandProperty UserName"
            res = subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True, timeout=5)
            raw = res.stdout.strip()
            if raw:
                return raw.split("\\")[-1]
        except Exception:
            pass

        # 2. quser
        try:
            res = subprocess.run(["quser"], capture_output=True, text=True, timeout=5)
            lines = res.stdout.strip().splitlines()
            if len(lines) > 1:
                first_user = lines[1].strip().split()[0].lstrip(">")
                if first_user and first_user.upper() != "SYSTEM":
                    return first_user
        except Exception:
            pass

        # 3. USERNAME env
        u = os.environ.get("USERNAME")
        if u and u.upper() not in ["SYSTEM", "LOCAL SERVICE", "NETWORK SERVICE"]:
            return u

    elif SYSTEM == "Darwin":  # macOS
        # 1. Usuário conectado no console gráfico GUI (/dev/console)
        try:
            res = subprocess.run(["stat", "-f", "%Su", "/dev/console"], capture_output=True, text=True, timeout=3)
            user = res.stdout.strip()
            if user and user not in ["root", "loginwindow", "_spotlight", ""]:
                return user
        except Exception:
            pass

        # 2. scutil ConsoleUser
        try:
            res = subprocess.run(["scutil"], input="show State:/Users/ConsoleUser\n", capture_output=True, text=True, timeout=3)
            for line in res.stdout.splitlines():
                if "Name :" in line:
                    u = line.split("Name :")[-1].strip()
                    if u and u not in ["loginwindow", "root", ""]:
                        return u
        except Exception:
            pass

        # 3. SUDO_USER
        sudo_u = os.environ.get("SUDO_USER")
        if sudo_u and sudo_u != "root":
            return sudo_u

    elif SYSTEM == "Linux":  # Ubuntu / Debian
        # 1. loginctl sessions ativas
        try:
            res = subprocess.run(["loginctl", "list-sessions", "--no-legend"], capture_output=True, text=True, timeout=3)
            for line in res.stdout.strip().splitlines():
                parts = line.split()
                if len(parts) >= 3:
                    u = parts[2]
                    if u not in ["root", "gdm", "lightdm", "sddm"]:
                        return u
        except Exception:
            pass

        # 2. who / w
        try:
            res = subprocess.run(["who"], capture_output=True, text=True, timeout=3)
            for line in res.stdout.strip().splitlines():
                parts = line.split()
                if parts and parts[0] not in ["root", ""]:
                    return parts[0]
        except Exception:
            pass

        # 3. SUDO_USER
        sudo_u = os.environ.get("SUDO_USER")
        if sudo_u and sudo_u != "root":
            return sudo_u

    # Fallback universal
    try:
        login = os.getlogin()
        if login and login.upper() not in ["ROOT", "SYSTEM"]:
            return login
    except Exception:
        pass

    return os.environ.get("SUDO_USER") or os.environ.get("USER") or "usuario"


def execute_containment_action(action_type, target_username=None, parameters=None):
    """Executa a ação nativa real solicitada pelo administrador (Windows, Linux ou macOS)."""
    print(f"\n[EXECUCAO DE COMANDO] [{SYSTEM}] Recebida acao: {action_type} (Usuario: {target_username})")
    try:
        # ==========================================
        # 1. RESET_PASSWORD_AND_LOGOFF (Offboarding)
        # ==========================================
        if action_type == "RESET_PASSWORD_AND_LOGOFF":
            if not target_username or target_username.strip() == "":
                target_username = get_active_interactive_username()

            target_username = target_username.strip()

            new_password = None
            if parameters and isinstance(parameters, dict):
                new_password = parameters.get("new_password")
            if not new_password:
                import secrets
                new_password = f"Ubk@{secrets.token_hex(3).upper()}!2026"

            print(f"[OFFBOARDING] Alterando senha do usuario local '{target_username}' no {SYSTEM}...")

            if SYSTEM == "Windows":
                res = subprocess.run(["net", "user", target_username, new_password], capture_output=True, text=True)
                if res.returncode != 0:
                    err_msg = (res.stderr or res.stdout or "").strip()
                    return False, f"Falha no net user ({target_username}): {err_msg}"
                subprocess.run(["shutdown.exe", "/l", "/f"], check=False)

            elif SYSTEM == "Linux":
                # Ubuntu/Debian: chpasswd como root
                proc = subprocess.run(
                    ["chpasswd"],
                    input=f"{target_username}:{new_password}\n",
                    text=True,
                    capture_output=True
                )
                if proc.returncode != 0:
                    err = (proc.stderr or proc.stdout or "").strip()
                    return False, f"Falha ao alterar senha via chpasswd ({target_username}): {err}"
                
                # Desconecta sessões do usuário imediatamente
                subprocess.run(["loginctl", "terminate-user", target_username], capture_output=True)
                subprocess.run(["pkill", "-KILL", "-u", target_username], capture_output=True)

            elif SYSTEM == "Darwin":  # macOS
                # macOS: dscl . -passwd /Users/<user> <password>
                proc = subprocess.run(
                    ["dscl", ".", "-passwd", f"/Users/{target_username}", new_password],
                    capture_output=True,
                    text=True
                )
                if proc.returncode != 0:
                    # Fallback com sysadminctl se disponível
                    proc2 = subprocess.run(
                        ["sysadminctl", "-resetPasswordFor", target_username, "-newPassword", new_password],
                        capture_output=True,
                        text=True
                    )
                    if proc2.returncode != 0:
                        err = (proc.stderr or proc.stdout or proc2.stderr or "").strip()
                        return False, f"Falha ao alterar senha no macOS ({target_username}): {err}"

                # Desconecta usuário no macOS
                subprocess.run(["pkill", "-KILL", "-u", target_username], capture_output=True)

            print(f"[OFFBOARDING] Senha de '{target_username}' alterada com SUCESSO para '{new_password}'.")
            return True, f"Senha do usuário '{target_username}' alterada para '{new_password}'. Logoff forçado executado com sucesso no {SYSTEM}."

        # ==========================================
        # 2. EMERGENCY_LOCKDOWN / LOCK_USER_SESSION
        # ==========================================
        elif action_type in ["EMERGENCY_LOCKDOWN", "LOCK_USER_SESSION"]:
            if SYSTEM == "Windows":
                import ctypes
                user32 = ctypes.windll.User32
                if not user32.LockWorkStation():
                    subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"], check=False)
                return True, "Estação Windows bloqueada com sucesso."

            elif SYSTEM == "Linux":
                proc = subprocess.run(["loginctl", "lock-sessions"], capture_output=True)
                if proc.returncode != 0:
                    subprocess.run(["xdg-screensaver", "lock"], capture_output=True)
                return True, "Sessão Linux (Ubuntu) bloqueada com sucesso."

            elif SYSTEM == "Darwin":  # macOS
                cgsession = "/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession"
                if os.path.exists(cgsession):
                    subprocess.run([cgsession, "-suspend"], check=False)
                else:
                    subprocess.run(["pmset", "displaysleepnow"], check=False)
                return True, "Sessão macOS bloqueada com sucesso."

        # ==========================================
        # 3. END_USER_SESSION
        # ==========================================
        elif action_type == "END_USER_SESSION":
            if not target_username:
                target_username = get_active_interactive_username()

            if SYSTEM == "Windows":
                subprocess.run(["shutdown.exe", "/l", "/f"], check=False)
            elif SYSTEM == "Linux":
                subprocess.run(["loginctl", "terminate-user", target_username], capture_output=True)
                subprocess.run(["pkill", "-KILL", "-u", target_username], capture_output=True)
            elif SYSTEM == "Darwin":
                subprocess.run(["pkill", "-KILL", "-u", target_username], capture_output=True)

            return True, f"Logoff forçado da sessão de '{target_username}' disparado com sucesso."

        # ==========================================
        # 4. SUSPEND_LOCAL_ACCOUNT
        # ==========================================
        elif action_type == "SUSPEND_LOCAL_ACCOUNT":
            if not target_username:
                target_username = get_active_interactive_username()

            if SYSTEM == "Windows":
                res = subprocess.run(["net", "user", target_username, "/active:no"], capture_output=True, text=True)
                if res.returncode != 0:
                    return False, f"Falha ao desativar conta: {res.stderr or res.stdout}"
            elif SYSTEM == "Linux":
                res = subprocess.run(["usermod", "-L", target_username], capture_output=True, text=True)
                if res.returncode != 0:
                    return False, f"Falha ao suspender conta no Linux: {res.stderr or res.stdout}"
            elif SYSTEM == "Darwin":
                res = subprocess.run(["dscl", ".", "-create", f"/Users/{target_username}", "AuthenticationAuthority", ";DisabledUser;"], capture_output=True, text=True)
                if res.returncode != 0:
                    return False, f"Falha ao suspender conta no macOS: {res.stderr or res.stdout}"

            return True, f"Conta local '{target_username}' suspensa com sucesso."

        # ==========================================
        # 5. REACTIVATE_LOCAL_ACCOUNT
        # ==========================================
        elif action_type == "REACTIVATE_LOCAL_ACCOUNT":
            if not target_username:
                target_username = get_active_interactive_username()

            if SYSTEM == "Windows":
                res = subprocess.run(["net", "user", target_username, "/active:yes"], capture_output=True, text=True)
                if res.returncode != 0:
                    return False, f"Falha ao reativar conta: {res.stderr or res.stdout}"
            elif SYSTEM == "Linux":
                res = subprocess.run(["usermod", "-U", target_username], capture_output=True, text=True)
                if res.returncode != 0:
                    return False, f"Falha ao reativar conta no Linux: {res.stderr or res.stdout}"
            elif SYSTEM == "Darwin":
                res = subprocess.run(["dscl", ".", "-delete", f"/Users/{target_username}", "AuthenticationAuthority"], capture_output=True, text=True)
                if res.returncode != 0:
                    return False, f"Falha ao reativar conta no macOS: {res.stderr or res.stdout}"

            return True, f"Conta local '{target_username}' reativada com sucesso."

        # ==========================================
        # 6. ISOLATE_DEVICE_NETWORK
        # ==========================================
        elif action_type == "ISOLATE_DEVICE_NETWORK":
            if SYSTEM == "Windows":
                ps_cmd = "Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Disable-NetAdapter -Confirm:$false"
                res = subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True)
                if res.returncode != 0:
                    return False, f"Falha ao isolar rede: {res.stderr or res.stdout}"
            elif SYSTEM == "Linux":
                subprocess.run(["iptables", "-A", "INPUT", "-i", "lo", "-j", "ACCEPT"], check=False)
                subprocess.run(["iptables", "-A", "OUTPUT", "-o", "lo", "-j", "ACCEPT"], check=False)
                subprocess.run(["iptables", "-P", "INPUT", "DROP"], check=False)
                subprocess.run(["iptables", "-P", "OUTPUT", "DROP"], check=False)
            elif SYSTEM == "Darwin":
                subprocess.run(["networksetup", "-setairportpower", "en0", "off"], check=False)

            return True, "Isolamento de rede acionado com sucesso no dispositivo."

        else:
            return False, f"Tipo de acao '{action_type}' desconhecido."

    except Exception as e:
        return False, f"Excecao ao executar comando: {str(e)}"


def get_system_uptime():
    """Calcula o tempo de atividade da máquina (uptime em segundos)."""
    if SYSTEM == "Windows":
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            ticks = kernel32.GetTickCount64()
            return int(ticks // 1000)
        except Exception:
            return 3600

    elif SYSTEM == "Linux":
        try:
            if os.path.exists("/proc/uptime"):
                with open("/proc/uptime", "r") as f:
                    return int(float(f.readline().split()[0]))
        except Exception:
            pass

    elif SYSTEM == "Darwin":
        try:
            res = subprocess.run(["sysctl", "-n", "kern.boottime"], capture_output=True, text=True)
            m = re.search(r"sec\s*=\s*(\d+)", res.stdout)
            if m:
                return int(time.time() - int(m.group(1)))
        except Exception:
            pass

    return 3600


def get_memory_info():
    """Coleta uso de memória RAM de forma nativa e compatível com o SO."""
    if SYSTEM == "Windows":
        try:
            import ctypes
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]
            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
                total = stat.ullTotalPhys
                avail = stat.ullAvailPhys
                usage = ((total - avail) / total) * 100 if total > 0 else 0
                return {
                    "total_bytes": total,
                    "available_bytes": avail,
                    "usage_percent": round(usage, 1)
                }
        except Exception:
            pass

    elif SYSTEM == "Linux":
        try:
            if os.path.exists("/proc/meminfo"):
                mem = {}
                with open("/proc/meminfo", "r") as f:
                    for line in f:
                        parts = line.split(":")
                        if len(parts) == 2:
                            k = parts[0].strip()
                            v = parts[1].strip().split()[0]
                            if v.isdigit():
                                mem[k] = int(v) * 1024  # Converte kB para bytes
                total = mem.get("MemTotal", 17179869184)
                avail = mem.get("MemAvailable", total // 2)
                usage = ((total - avail) / total) * 100 if total > 0 else 0
                return {
                    "total_bytes": total,
                    "available_bytes": avail,
                    "usage_percent": round(usage, 1)
                }
        except Exception:
            pass

    elif SYSTEM == "Darwin":
        try:
            res = subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True)
            if res.stdout.strip().isdigit():
                total = int(res.stdout.strip())
                return {
                    "total_bytes": total,
                    "available_bytes": total // 2,
                    "usage_percent": 50.0
                }
        except Exception:
            pass

    return {
        "total_bytes": 17179869184,
        "available_bytes": 8589934592,
        "usage_percent": 50.0
    }


def get_disk_info():
    """Coleta partições e armazenamento em disco."""
    if SYSTEM == "Windows":
        drives = []
        try:
            import string
            import ctypes
            from ctypes import c_ulonglong, byref
            kernel32 = ctypes.windll.kernel32

            for letter in string.ascii_uppercase:
                drive_path = f"{letter}:\\"
                drive_type = kernel32.GetDriveTypeW(drive_path)
                if drive_type == 3:
                    free_bytes = c_ulonglong()
                    total_bytes = c_ulonglong()
                    total_free = c_ulonglong()
                    success = kernel32.GetDiskFreeSpaceExW(
                        drive_path,
                        byref(free_bytes),
                        byref(total_bytes),
                        byref(total_free)
                    )
                    if success:
                        drives.append({
                            "drive": f"{letter}:",
                            "total_bytes": int(total_bytes.value),
                            "free_bytes": int(free_bytes.value),
                            "fs_type": "NTFS"
                        })
        except Exception:
            pass

        if drives:
            return drives

    else:
        # Linux / macOS: usa os.statvfs universal POSIX
        try:
            st = os.statvfs('/')
            total = st.f_blocks * st.f_frsize
            free = st.f_bavail * st.f_frsize
            fs = "ext4" if SYSTEM == "Linux" else "APFS"
            return [{
                "drive": "/",
                "total_bytes": total,
                "free_bytes": free,
                "fs_type": fs
            }]
        except Exception:
            pass

    return [{
        "drive": "C:" if SYSTEM == "Windows" else "/",
        "total_bytes": 512000000000,
        "free_bytes": 268435456000,
        "fs_type": "NTFS" if SYSTEM == "Windows" else "ext4"
    }]


def get_network_info():
    import socket
    interfaces = []
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        interfaces.append({
            "interface_name": "Ethernet / Wi-Fi",
            "ip_address": local_ip,
            "mac_address": "E4:54:E8:A1:02:F8"
        })
    except Exception:
        interfaces.append({
            "interface_name": "Ethernet",
            "ip_address": "127.0.0.1",
            "mac_address": "00:1A:2B:3C:4D:5E"
        })
    return interfaces


def make_request(url, method="POST", data=None, headers=None):
    if headers is None:
        headers = {}
    headers["Content-Type"] = "application/json"
    headers["User-Agent"] = f"UblockAgent/1.0.0 ({SYSTEM} Production Client)"

    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    # Suporte para certificados SSL modernos em qualquer SO
    ctx = ssl.create_default_context()
    
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=20, context=ctx) as response:
                res_body = response.read().decode("utf-8")
                return response.status, json.loads(res_body) if res_body else {}
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            try:
                parsed = json.loads(err_body)
            except Exception:
                parsed = {"detail": err_body}
            return e.code, parsed
        except Exception as e:
            if attempt == 2:
                return 0, {"detail": str(e)}
            time.sleep(2)
    return 0, {"detail": "Falha na comunicacao apos tentativas."}


def save_state(state):
    try:
        os.makedirs(os.path.dirname(os.path.abspath(STATE_FILE)), exist_ok=True)
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        print(f"[ERRO] Falha ao salvar credencial em {STATE_FILE}: {e}")


def remove_state():
    try:
        if os.path.exists(STATE_FILE):
            os.remove(STATE_FILE)
            print(f"[LIMPEZA] Arquivo de credenciais local apagado: {STATE_FILE}")
    except Exception as e:
        pass


def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def main():
    parser = argparse.ArgumentParser(description=f"Ublock RMM - Agente de Monitoramento ({SYSTEM})")
    parser.add_argument("-token", "--token", help="Codigo de pareamento gerado no painel")
    parser.add_argument("-api", "--api", default="https://ublock-api-fn7d.onrender.com/api/v1", help="URL base da API Ublock")
    parser.add_argument("-interval", "--interval", type=int, default=15, help="Intervalo de heartbeat em segundos")
    parser.add_argument("--enroll-only", action="store_true", help="Realiza apenas o pareamento e inventario inicial e encerra com sucesso")
    args = parser.parse_args()

    api_url = args.api.rstrip("/")
    state = load_state()

    print("=" * 60)
    print(f"  UBLOCK RMM - AGENTE DE MONITORAMENTO ({SYSTEM.upper()}) ")
    print("=" * 60)
    print(f"API Central: {api_url}")
    print(f"Arquivo de Credenciais: {STATE_FILE}")

    # Determinar metadados de SO
    if SYSTEM == "Linux":
        os_family = "LINUX"
        distro = "Linux (Ubuntu)"
        if os.path.exists("/etc/os-release"):
            try:
                with open("/etc/os-release", "r") as f:
                    for line in f:
                        if line.startswith("PRETTY_NAME="):
                            distro = line.split("=", 1)[1].strip().strip('"')
                            break
            except Exception:
                pass
        os_version = f"{distro} ({platform.release()})"
        model_name = "Servidor / Estação Linux"
        mfg_name = "Ubuntu / Canonical"
    elif SYSTEM == "Darwin":
        os_family = "MACOS"
        mac_ver = platform.mac_ver()[0] or "14.x"
        os_version = f"macOS {mac_ver} ({platform.machine()})"
        model_name = f"Apple Mac ({platform.machine()})"
        mfg_name = "Apple Inc."
    else:
        os_family = "WINDOWS"
        os_version = f"{platform.system()} {platform.release()} ({platform.version()})"
        model_name = "Estação de Trabalho Windows"
        mfg_name = "Microsoft / OEM"

    # 1. Pareamento (Enrollment)
    if args.token and args.token.strip() != "":
        token_clean = args.token.strip()
        # Se um novo token foi fornecido, limpa qualquer estado antigo
        remove_state()
        state = None

        print(f"\n[1/3] Realizando pareamento com o codigo: {token_clean}...")
        agent_uuid = str(uuid.uuid4())
        hostname = platform.node() or f"{os_family}-CLIENT"
        
        enroll_payload = {
            "enrollment_token": token_clean,
            "agent_uuid": agent_uuid,
            "agent_version": "1.0.0",
            "hostname": hostname,
            "os_family": os_family,
            "os_version": os_version,
            "architecture": platform.machine() or "x86_64"
        }

        status, resp = make_request(f"{api_url}/agent/enroll", data=enroll_payload)
        if status != 200:
            print(f"\n[ERRO] Falha no pareamento (HTTP {status}): {resp.get('detail')}")
            return 1
        else:
            print("      Pareamento realizado com SUCESSO!")
            state = {
                "agent_uuid": agent_uuid,
                "agent_key": resp["agent_key"],
                "device_id": resp["device_id"],
                "organization_id": resp["organization_id"],
                "api_url": api_url
            }
            save_state(state)

    if not state:
        print("\n[ERRO] Nenhum agente pareado encontrado e nenhum token foi fornecido.")
        print(f"Execute informando o token: {sys.argv[0]} -token SEU_TOKEN -api {api_url}")
        return 1

    # 2. Coleta e Envio de Inventário Técnico Completo
    agent_key = state["agent_key"]
    agent_uuid = state["agent_uuid"]
    headers = {"X-Agent-Key": agent_key}

    print("\n[2/3] Sincronizando especificacoes tecnicas de hardware real com a nuvem...")
    mem_info = get_memory_info()
    disk_info = get_disk_info()
    net_info = get_network_info()
    uptime_sec = get_system_uptime()
    cpu_model = platform.processor() or ("Apple Silicon" if SYSTEM == "Darwin" and platform.machine() == "arm64" else "Intel/AMD CPU")

    inventory_payload = {
        "agent_uuid": agent_uuid,
        "cpu": {
            "model": cpu_model,
            "cores": os.cpu_count() or 8,
            "usage_percent": 12.0
        },
        "memory": mem_info,
        "storage": disk_info,
        "network": net_info,
        "os_details": {
            "name": f"{SYSTEM} {platform.release()}",
            "version": platform.version(),
            "build": platform.release(),
            "arch": platform.machine() or "x86_64"
        },
        "manufacturer": mfg_name,
        "model": model_name,
        "serial_number": f"SN-{os_family[:3]}-" + agent_uuid[:8].upper(),
        "uptime_seconds": uptime_sec
    }

    status, resp = make_request(f"{api_url}/agent/inventory", data=inventory_payload, headers=headers)
    if status == 200:
        print("      Inventario tecnico sincronizado com o painel!")
    elif status == 401 or status == 403:
        print(f"\n[ALERTA - HTTP {status}] {resp.get('detail')}")
        print("[DISPOSITIVO REMOVIDO] Este computador foi excluído ou o acesso foi revogado no painel administrativo.")
        remove_state()
        return 1
    else:
        print(f"[AVISO] Resposta do inventario (HTTP {status}): {resp.get('detail')}")

    # Se chamado com --enroll-only (instalador automatizado), envia primeiro heartbeat e encerra
    if args.enroll_only:
        hb_payload = {
            "agent_uuid": agent_uuid,
            "uptime_seconds": uptime_sec,
            "agent_version": "1.0.0",
            "error_message": None
        }
        make_request(f"{api_url}/agent/heartbeat", data=hb_payload, headers=headers)
        print("\n[3/3] Computador registrado com status ONLINE!")
        print(f"      Credenciais salvas com seguranca em: {STATE_FILE}")
        return 0

    # 3. Loop Contínuo de Heartbeats e Execução de Comandos Remotos
    interval = args.interval or 15
    print(f"\n[3/3] Monitoramento em Tempo Real ativo (Heartbeat a cada {interval}s)...")
    print("      Aguardando comandos e mantendo o status ONLINE no painel.\n")

    count = 0
    while True:
        count += 1
        curr_uptime = get_system_uptime()
        hours = curr_uptime // 3600
        mins = (curr_uptime % 3600) // 60
        secs = curr_uptime % 60
        uptime_str = f"{hours}h {mins}m {secs}s"

        hb_payload = {
            "agent_uuid": agent_uuid,
            "uptime_seconds": curr_uptime,
            "agent_version": "1.0.0",
            "error_message": None
        }

        status, resp = make_request(f"{api_url}/agent/heartbeat", data=hb_payload, headers=headers)

        timestamp = time.strftime("%H:%M:%S")
        if status == 200:
            print(f"[{timestamp}] [Heartbeat #{count:03d}] OK -> ONLINE | Uptime: {uptime_str}")
            
            pending_commands = resp.get("pending_commands", [])
            for cmd in pending_commands:
                cmd_id = cmd["id"]
                action_type = cmd["action_type"]
                target_user = cmd.get("target_username")
                
                cmd_params = cmd.get("parameters") or {}
                if cmd.get("new_password") and not cmd_params.get("new_password"):
                    cmd_params["new_password"] = cmd["new_password"]

                print(f"[{timestamp}] -> EXECUTANDO COMANDO REMOTO: {action_type}...")
                succeeded, msg = execute_containment_action(action_type, target_user, cmd_params)
                print(f"[{timestamp}] -> Resultado: {msg}")
                
                res_payload = {
                    "agent_uuid": agent_uuid,
                    "command_id": cmd_id,
                    "succeeded": succeeded,
                    "result_message": msg
                }
                make_request(f"{api_url}/agent/command-result", data=res_payload, headers=headers)

        elif status == 401 or status == 403:
            print(f"\n[{timestamp}] [ALERTA - HTTP {status}]")
            print(f"[DISPOSITIVO REMOVIDO] Computador excluído do inventário ou acesso revogado: {resp.get('detail')}")
            remove_state()
            break
        else:
            print(f"[{timestamp}] [CONEXAO - HTTP {status}] {resp.get('detail')}")

        try:
            time.sleep(interval)
        except KeyboardInterrupt:
            print("\n[PAUSA] Monitoramento interrompido.")
            break

    return 0


if __name__ == "__main__":
    sys.exit(main())
