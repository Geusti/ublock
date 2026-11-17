import React, { useEffect, useRef, useState } from 'react';
import { Device } from '../types';
import { 
  X, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  Monitor, 
  ShieldCheck, 
  AlertTriangle,
  Command,
  Activity
} from 'lucide-react';

interface RemoteDesktopModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RemoteDesktopModal: React.FC<RemoteDesktopModalProps> = ({
  device,
  isOpen,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [kbs, setKbs] = useState(0);
  const [resolution, setResolution] = useState<{ width: number; height: number }>({ width: 1280, height: 720 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Metricas de performance
  const framesCountRef = useRef(0);
  const bytesCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    if (!isOpen || !device) return;

    setStatus('connecting');
    setErrorMessage(null);

    // Identificar URL base do WebSocket
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://ublock-api-fn7d.onrender.com/api/v1';
    const wsProto = apiUrl.startsWith('https') ? 'wss:' : 'ws:';
    const hostAndPath = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const token = localStorage.getItem('ublock_token') || localStorage.getItem('token') || '';

    const wsUrl = `${wsProto}//${hostAndPath}/remote-desktop/ws/viewer/${device.id}?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'blob';
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connecting');
      if (containerRef.current) containerRef.current.focus();
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'agent_status') {
            if (msg.status === 'connected') {
              setStatus('connected');
            } else {
              setStatus('disconnected');
            }
          } else if (msg.type === 'screen_info') {
            setResolution({ width: msg.width, height: msg.height });
            if (canvasRef.current) {
              canvasRef.current.width = msg.width;
              canvasRef.current.height = msg.height;
            }
          } else if (msg.type === 'error') {
            setStatus('error');
            setErrorMessage(msg.message || 'Erro de autenticação na sessão remota.');
          }
        } catch (e) {
          console.error(e);
        }
      } else if (event.data instanceof Blob) {
        framesCountRef.current++;
        bytesCountRef.current += event.data.size;
        setStatus('connected');

        try {
          const bitmap = await createImageBitmap(event.data);
          const canvas = canvasRef.current;
          if (canvas) {
            if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
              canvas.width = bitmap.width;
              canvas.height = bitmap.height;
              setResolution({ width: bitmap.width, height: bitmap.height });
            }
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.drawImage(bitmap, 0, 0);
          }
        } catch (e) {
          console.error('Erro ao renderizar frame:', e);
        }
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    ws.onerror = () => {
      setStatus('error');
      setErrorMessage('Falha ao conectar ao servidor de relay.');
    };

    // Medidor de FPS e Banda
    const perfInterval = setInterval(() => {
      const now = performance.now();
      const elapsed = (now - lastTimeRef.current) / 1000;
      if (elapsed > 0) {
        setFps(Math.round(framesCountRef.current / elapsed));
        setKbs(Math.round((bytesCountRef.current / 1024) / elapsed));
      }
      framesCountRef.current = 0;
      bytesCountRef.current = 0;
      lastTimeRef.current = now;
    }, 1000);

    return () => {
      clearInterval(perfInterval);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [isOpen, device]);

  if (!isOpen || !device) return null;

  // Calculo de coordenadas normalizadas no Canvas
  const getNormalizedCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = resolution.width / rect.width;
    const scaleY = resolution.height / rect.height;

    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const coords = getNormalizedCoords(e);
    ws.send(JSON.stringify({ type: 'mouse_move', x: coords.x, y: coords.y }));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const coords = getNormalizedCoords(e);
    const button = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
    ws.send(JSON.stringify({ type: 'mouse_down', button, x: coords.x, y: coords.y }));
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const coords = getNormalizedCoords(e);
    const button = e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle';
    ws.send(JSON.stringify({ type: 'mouse_up', button, x: coords.x, y: coords.y }));
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'mouse_wheel', delta: e.deltaY > 0 ? -1 : 1 }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace'].includes(e.code)) {
      e.preventDefault();
    }

    ws.send(JSON.stringify({ type: 'key_down', key: e.key, code: e.code }));
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'key_up', key: e.key, code: e.code }));
  };

  const sendSpecialKey = (command: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'special_key', command }));
    if (containerRef.current) containerRef.current.focus();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        className="bg-[#0B1120] border border-[#24334C] rounded-2xl w-full h-[94vh] max-w-7xl flex flex-col overflow-hidden shadow-2xl relative outline-none"
      >
        {/* Header / Barra de Ferramentas */}
        <div className="bg-[#151F32] border-b border-[#24334C] px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {device.display_name || device.hostname}
                </h3>
                <span className="text-[11px] font-mono text-slate-400">({device.local_ip || 'IP N/A'})</span>
                
                {status === 'connected' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    ONLINE (Ao Vivo)
                  </span>
                )}
                {status === 'connecting' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Conectando...
                  </span>
                )}
                {status === 'disconnected' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    Aguardando Agente
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="font-mono">{fps} FPS</span>
                <span>•</span>
                <span className="font-mono">{kbs} KB/s</span>
                <span>•</span>
                <span className="font-mono">{resolution.width}x{resolution.height}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-500">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Auditado PSI-001 a PSI-006 (WSS TLS 1.3)
                </span>
              </div>
            </div>
          </div>

          {/* Atalhos Rápidos */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => sendSpecialKey('ctrl_alt_del')}
              className="px-2.5 py-1.5 rounded-lg bg-[#24334C] hover:bg-[#334155] text-slate-200 hover:text-white text-xs font-medium transition flex items-center gap-1.5"
            >
              <Command className="w-3.5 h-3.5 text-blue-400" />
              Ctrl + Alt + Del
            </button>
            <button
              onClick={() => sendSpecialKey('win')}
              className="px-2.5 py-1.5 rounded-lg bg-[#24334C] hover:bg-[#334155] text-slate-200 hover:text-white text-xs font-medium transition"
            >
              Tecla Windows
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-[#24334C] hover:bg-[#334155] text-slate-200 hover:text-white transition"
              title="Tela Cheia"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-300 transition"
              title="Encerrar Sessão"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Área do Canvas de Transmissão */}
        <div className="flex-1 bg-[#060913] flex items-center justify-center relative overflow-hidden select-none">
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
            className="max-w-full max-h-full object-contain cursor-default shadow-2xl rounded"
          />

          {/* Overlay de Status quando Desconectado / Conectando */}
          {status !== 'connected' && (
            <div className="absolute inset-0 bg-[#060913]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4 animate-pulse">
                <Monitor className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-bold text-white mb-1">
                {status === 'connecting' && 'Iniciando Sessão Remota Criptografada...'}
                {status === 'disconnected' && 'Aguardando Agente do Computador...'}
                {status === 'error' && 'Falha na Conexão Remota'}
              </h4>
              <p className="text-xs text-slate-400 max-w-md">
                {errorMessage || (
                  status === 'connecting'
                    ? 'Estabelecendo handshake seguro WSS e autorizando canal sob a política PSI-001.'
                    : 'O computador precisa estar ligado e com o agente Ublock ativo em segundo plano para transmitir a tela.'
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
