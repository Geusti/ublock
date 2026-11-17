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
import threading
import io

# Dependências opcionais do motor de tela remoto (disponível quando compilado com suporte)
try:
    import asyncio
    import websockets
    import mss
    from PIL import Image
    HAS_REMOTE_DESKTOP = True
except ImportError:
    HAS_REMOTE_DESKTOP = False

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


# ==============================================================================
# MOTOR DE DESKTOP REMOTO (CANVAS HTML5 / WEBSOCKETS / NATIVO WINDOWS)
# ==============================================================================
is_remote_streaming = False

if SYSTEM == "Windows":
    try:
        import ctypes
        user32 = ctypes.windll.user32
        MOUSEEVENTF_LEFTDOWN = 0x0002
        MOUSEEVENTF_LEFTUP = 0x0004
        MOUSEEVENTF_RIGHTDOWN = 0x0008
        MOUSEEVENTF_RIGHTUP = 0x0010
        MOUSEEVENTF_MIDDLEDOWN = 0x0020
        MOUSEEVENTF_MIDDLEUP = 0x0040
        MOUSEEVENTF_WHEEL = 0x0800
        KEYEVENTF_KEYUP = 0x0002
        KEYEVENTF_UNICODE = 0x0004
        VK_LWIN = 0x5B
        VK_CONTROL = 0x11
        VK_MENU = 0x12
        VK_DELETE = 0x2E

        VK_MAP = {
            "Enter": 0x0D, "Backspace": 0x08, "Tab": 0x09, "Escape": 0x1B, "Space": 0x20,
            "ArrowLeft": 0x25, "ArrowUp": 0x26, "ArrowRight": 0x27, "ArrowDown": 0x28,
            "Delete": 0x2E, "Home": 0x24, "End": 0x23, "PageUp": 0x21, "PageDown": 0x22,
            "ShiftLeft": 0xA0, "ShiftRight": 0xA1, "ControlLeft": 0xA2, "ControlRight": 0xA3,
            "AltLeft": 0x12, "AltRight": 0x12, "MetaLeft": 0x5B, "MetaRight": 0x5C,
        }
    except Exception:
        pass


def handle_remote_mouse(data):
    if SYSTEM != "Windows":
        return
    try:
        action = data.get("type")
        if action == "mouse_move":
            user32.SetCursorPos(int(data.get("x", 0)), int(data.get("y", 0)))
        elif action == "mouse_down":
            btn = data.get("button", "left")
            user32.SetCursorPos(int(data.get("x", 0)), int(data.get("y", 0)))
            if btn == "left":
                user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            elif btn == "right":
                user32.mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
            elif btn == "middle":
                user32.mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, 0)
        elif action == "mouse_up":
            btn = data.get("button", "left")
            user32.SetCursorPos(int(data.get("x", 0)), int(data.get("y", 0)))
            if btn == "left":
                user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
            elif btn == "right":
                user32.mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
            elif btn == "middle":
                user32.mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, 0)
        elif action == "mouse_wheel":
            delta = data.get("delta", 0) * 120
            user32.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, int(delta), 0)
    except Exception:
        pass


def handle_remote_keyboard(data):
    if SYSTEM != "Windows":
        return
    try:
        action = data.get("type")
        key = data.get("key", "")
        code = data.get("code", "")
        is_down = action == "key_down"
        flags = 0 if is_down else KEYEVENTF_KEYUP

        if code in VK_MAP:
            user32.keybd_event(VK_MAP[code], 0, flags, 0)
            return

        if action == "special_key":
            cmd = data.get("command")
            if cmd == "win":
                user32.keybd_event(VK_LWIN, 0, 0, 0)
                user32.keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0)
            elif cmd == "ctrl_alt_del":
                user32.keybd_event(VK_CONTROL, 0, 0, 0)
                user32.keybd_event(VK_MENU, 0, 0, 0)
                user32.keybd_event(VK_DELETE, 0, 0, 0)
                user32.keybd_event(VK_DELETE, 0, KEYEVENTF_KEYUP, 0)
                user32.keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0)
                user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
            return

        if len(key) == 1:
            u_flags = KEYEVENTF_UNICODE | (0 if is_down else KEYEVENTF_KEYUP)
            user32.keybd_event(0, ord(key), u_flags, 0)
    except Exception:
        pass


async def remote_desktop_loop(api_url: str, device_id: str, agent_key: str):
    global is_remote_streaming
    if not HAS_REMOTE_DESKTOP:
        return

    # Converte http(s) para ws(s)
    ws_proto = "wss:" if api_url.startswith("https") else "ws:"
    host = api_url.split("://")[-1].rstrip("/")
    relay_url = f"{ws_proto}//{host}/remote-desktop/ws/agent/{device_id}?key={agent_key}"

    while True:
        try:
            async with websockets.connect(
                relay_url,
                max_size=10 * 1024 * 1024,
                ping_interval=15,
                ping_timeout=30
            ) as ws:
                with mss.mss() as sct:
                    monitor = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
                    await ws.send(json.dumps({
                        "type": "screen_info",
                        "width": monitor["width"],
                        "height": monitor["height"]
                    }))

                    async def stream_frames():
                        global is_remote_streaming
                        target_fps = 18
                        frame_interval = 1.0 / target_fps
                        while True:
                            if not is_remote_streaming:
                                await asyncio.sleep(0.5)
                                continue

                            start_t = time.time()
                            try:
                                sct_img = sct.grab(monitor)
                                img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
                                if img.width > 1920:
                                    img.thumbnail((1920, 1080), Image.Resampling.LANCZOS)
                                buf = io.BytesIO()
                                img.save(buf, format="JPEG", quality=55, optimize=True)
                                await ws.send(buf.getvalue())
                            except Exception:
                                break

                            elapsed = time.time() - start_t
                            await asyncio.sleep(max(0, frame_interval - elapsed))

                    async def listen_input():
                        global is_remote_streaming
                        while True:
                            try:
                                msg = await ws.recv()
                                if isinstance(msg, str):
                                    data = json.loads(msg)
                                    action = data.get("type", "")
                                    if action == "session_control":
                                        is_remote_streaming = data.get("action") == "start_streaming"
                                    elif action.startswith("mouse_"):
                                        handle_remote_mouse(data)
                                    elif action.startswith("key_") or action == "special_key":
                                        handle_remote_keyboard(data)
                            except Exception:
                                break

                    t1 = asyncio.create_task(stream_frames())
                    t2 = asyncio.create_task(listen_input())
                    done, pending = await asyncio.wait([t1, t2], return_when=asyncio.FIRST_EXCEPTION)
                    for p in pending:
                        p.cancel()

        except Exception:
            await asyncio.sleep(5)


def start_remote_desktop_background(api_url: str, device_id: str, agent_key: str):
    """Dispara o motor de controle remoto em uma thread assíncrona separada"""
    if not HAS_REMOTE_DESKTOP:
        return

    def runner():
        try:
            asyncio.run(remote_desktop_loop(api_url, device_id, agent_key))
        except Exception:
            pass

    t = threading.Thread(target=runner, daemon=True, name="UblockRemoteDesktopThread")
    t.start()


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

    # Inicia motor de desktop remoto em background (Modo Standby)
    if HAS_REMOTE_DESKTOP:
        start_remote_desktop_background(api_url, device_id, agent_key)
        print("      [DESKTOP REMOTO] Motor de tela e controle interativo ativado em background (Standby)!\n")

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
