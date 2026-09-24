import { useEffect, useState, useRef, useMemo } from "react";
import { store, Pasture, Animal } from "@/lib/store";
import { useNavigate } from "react-router-dom";
import { 
  MapPin, 
  Plus, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Upload, 
  Move, 
  Edit3, 
  Trash2, 
  Layers, 
  Check, 
  AlertCircle, 
  Clock, 
  Compass, 
  Eye, 
  Maximize2, 
  Minimize2,
  Info,
  ArrowRightLeft,
  ChevronRight,
  ShieldCheck,
  Trees,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Hand
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// Imagem aérea satélite padrão da Fazenda Dois Irmãos (Google Earth)
const DEFAULT_SATELLITE_BG = "/fazenda_dois_irmaos.jpg";

export default function PasturesPage() {
  const navigate = useNavigate();
  const [pastures, setPastures] = useState<Pasture[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);

  // Imagem do mapa de satélite (carrega imediatamente o mapa ativo/atual do usuário para não piscar o mapa antigo)
  const [mapImage, setMapImage] = useState<string>(() => {
    try {
      const saved = store.getPastureMapImage();
      if (saved && !saved.includes("unsplash")) {
        return saved;
      }
    } catch {}
    return DEFAULT_SATELLITE_BG;
  });

  // Estados de Interação do Mapa
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragMode, setIsDragMode] = useState<boolean>(false);
  const [draggingPastureId, setDraggingPastureId] = useState<string | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchPinchDist = useRef<number | null>(null);

  // Pasto Selecionado
  const [selectedPastureId, setSelectedPastureId] = useState<string | null>(null);

  // Estilo e tamanho dos rótulos dos pastos no mapa (Padrão: número puro sem a palavra 'pasto')
  const [markerStyle, setMarkerStyle] = useState<"compact" | "mini" | "number">(() => {
    try {
      const saved = localStorage.getItem("pasture_marker_style");
      if (saved === "compact" || saved === "mini" || saved === "number") return saved;
      return "number";
    } catch {
      return "number";
    }
  });

  const updateMarkerStyle = (style: "compact" | "mini" | "number") => {
    setMarkerStyle(style);
    try {
      localStorage.setItem("pasture_marker_style", style);
    } catch {}
  };
  const [showMarkerDetails, setShowMarkerDetails] = useState<boolean>(false);
  const [markerScale, setMarkerScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("pasture_marker_scale");
      return saved ? Math.max(0.4, Math.min(1.4, parseFloat(saved))) : 0.7;
    } catch {
      return 0.7;
    }
  });
  const [autoScaleMarkers, setAutoScaleMarkers] = useState<boolean>(true);

  // Alterar tamanho do marcador e salvar preferência
  const changeMarkerScale = (newScale: number) => {
    const clamped = Math.max(0.4, Math.min(1.4, Number(newScale.toFixed(2))));
    setMarkerScale(clamped);
    try {
      localStorage.setItem("pasture_marker_scale", String(clamped));
    } catch {}
  };

  // Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMoveLotModal, setShowMoveLotModal] = useState(false);
  const [clickCoordinates, setClickCoordinates] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  // Formulário de Pasto
  const [pastureForm, setPastureForm] = useState({
    id: "",
    number: "",
    name: "",
    area_ha: "15",
    grass_type: "Brachiaria Marandu",
    status: "descanso" as "ocupado" | "descanso" | "vedado" | "reforma",
    current_lot: "",
    capacity_ua: "25",
    water_source: "Bebedouro Australiano",
    notes: "",
    x: 50,
    y: 50,
    scale: 0.7
  });

  // Modal de Confirmação de Exclusão (sem window.confirm)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pastureToDelete, setPastureToDelete] = useState<Pasture | null>(null);

  // Modo de reposicionamento por clique no mapa
  const [repositioningPastureId, setRepositioningPastureId] = useState<string | null>(null);

  // Formulário de Mudança de Lote entre Pastos
  const [moveLotForm, setMoveLotForm] = useState({
    targetPastureId: "",
    lotName: ""
  });

  const viewportRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({ width: 800, height: 600 });

  useEffect(() => {
    if (!viewportRef.current) return;
    const updateSize = () => {
      if (viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setViewportSize({ width: rect.width, height: rect.height });
        }
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(viewportRef.current);
    window.addEventListener("resize", updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [isExpanded]);

  const loadData = async () => {
    // Sincroniza o mapa atual de imediato sem esperar o carregamento da rede
    const savedImgImmediate = store.getPastureMapImage();
    if (savedImgImmediate && !savedImgImmediate.includes("unsplash")) {
      setMapImage(savedImgImmediate);
    }

    setLoading(true);
    try {
      const [pasturesData, animalsData] = await Promise.all([
        store.getPastures(),
        store.getAnimals()
      ]);
      setPastures(pasturesData);
      setAnimals(animalsData);

      const savedImg = store.getPastureMapImage();
      if (savedImg && !savedImg.includes("unsplash")) {
        setMapImage(savedImg);
      }
    } catch (e) {
      toast.error("Erro ao carregar dados dos pastos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Lotes únicos ativos
  const availableLots = useMemo(() => {
    const set = new Set<string>();
    animals.filter(a => a.status === "ativo" && a.lote_id).forEach(a => set.add(a.lote_id!));
    return Array.from(set).sort();
  }, [animals]);

  // Contagem de animais por pasto/lote
  const pastureDetails = useMemo(() => {
    return pastures.map(p => {
      const lotAnimals = p.current_lot 
        ? animals.filter(a => a.status === "ativo" && a.lote_id === p.current_lot)
        : [];
      
      const headCount = lotAnimals.length;
      const totalWeight = lotAnimals.reduce((acc, a) => acc + (a.weight || 400), 0);
      const totalUa = totalWeight / 450; // 1 UA = 450 kg
      const stockingRate = p.area_ha > 0 ? (totalUa / p.area_ha) : 0;

      return {
        ...p,
        lotAnimals,
        headCount,
        totalUa,
        stockingRate
      };
    });
  }, [pastures, animals]);

  const selectedPasture = useMemo(() => {
    return pastureDetails.find(p => p.id === selectedPastureId) || null;
  }, [pastureDetails, selectedPastureId]);

  // KPIs
  const metrics = useMemo(() => {
    const totalArea = pastures.reduce((acc, p) => acc + (p.area_ha || 0), 0);
    const occupied = pastures.filter(p => p.status === "ocupado").length;
    const resting = pastures.filter(p => p.status === "descanso").length;
    const deferred = pastures.filter(p => p.status === "vedado" || p.status === "reforma").length;
    
    const totalAnimalsInPastures = pastureDetails.reduce((acc, p) => acc + p.headCount, 0);

    return {
      totalArea,
      totalPastures: pastures.length,
      occupied,
      resting,
      deferred,
      totalAnimalsInPastures
    };
  }, [pastures, pastureDetails]);

  // Upload da imagem do Google Earth
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 8MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setMapImage(base64);
        store.setPastureMapImage(base64);
        toast.success("Foto de satélite / Google Earth atualizada com sucesso!");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetImage = async () => {
    setMapImage(DEFAULT_SATELLITE_BG);
    store.setPastureMapImage(null);
    const defaultPastures = await store.resetPasturesToFazendaDoisIrmaos();
    setPastures(defaultPastures);
    toast.success("Foto e 9 piquetes da Fazenda Dois Irmãos sincronizados!");
  };

  // Controles de Navegação e Zoom
  const handleZoomIn = () => setZoom(prev => Math.min(parseFloat((prev + 0.25).toFixed(2)), 4.0));
  const handleZoomOut = () => setZoom(prev => Math.max(parseFloat((prev - 0.25).toFixed(2)), 0.6));
  const handleSetZoom = (newZoom: number) => setZoom(newZoom);
  
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    toast.info("Visualização centralizada na fazenda");
  };

  // Deslocamento direcional do mapa (Arrastar pro lado, cima, baixo)
  const panBy = (dx: number, dy: number) => {
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  // Zoom com a rodinha do mouse (scroll wheel / trackpad pinch)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const zoomStep = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom(prev => {
      const next = Math.min(Math.max(prev + zoomStep, 0.6), 4.5);
      return parseFloat(next.toFixed(2));
    });
  };

  // Suporte a toque para celulares e tablets (Touch drag & pinch zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsPanning(true);
      setStartPan({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
      dragStartPos.current = { x: touch.clientX, y: touch.clientY };
      setHasDragged(false);
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchPinchDist.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanning) {
      const touch = e.touches[0];
      const dist = Math.hypot(
        touch.clientX - dragStartPos.current.x,
        touch.clientY - dragStartPos.current.y
      );
      if (dist > 4) {
        setHasDragged(true);
      }
      setPan({
        x: touch.clientX - startPan.x,
        y: touch.clientY - startPan.y
      });
    } else if (e.touches.length === 2 && touchPinchDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchPinchDist.current;
      setZoom(prev => {
        const next = Math.min(Math.max(prev * (1 + (ratio - 1) * 0.4), 0.6), 4.5);
        return parseFloat(next.toFixed(2));
      });
      touchPinchDist.current = dist;
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    touchPinchDist.current = null;
  };

  // Pan / Navegação com mouse (Arrastar o mapa para os lados)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (draggingPastureId) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setHasDragged(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && !draggingPastureId) {
      const dist = Math.hypot(
        e.clientX - dragStartPos.current.x,
        e.clientY - dragStartPos.current.y
      );
      if (dist > 4) {
        setHasDragged(true);
      }
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y
      });
      return;
    }

    // Se estiver arrastando um número de pasto no mapa
    if (draggingPastureId && mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      const rawX = ((e.clientX - rect.left) / rect.width) * 100;
      const rawY = ((e.clientY - rect.top) / rect.height) * 100;

      const clampedX = Math.max(3, Math.min(97, rawX));
      const clampedY = Math.max(4, Math.min(96, rawY));

      setPastures(prev => prev.map(p => {
        if (p.id === draggingPastureId) {
          return { ...p, x: Math.round(clampedX), y: Math.round(clampedY) };
        }
        return p;
      }));
    }
  };

  const handleMouseUp = async () => {
    setIsPanning(false);
    if (draggingPastureId) {
      const p = pastures.find(item => item.id === draggingPastureId);
      if (p) {
        await store.updatePasture(p.id, { x: p.x, y: p.y });
        toast.success(`Posição do Pasto #${p.number} atualizada no mapa!`);
      }
      setDraggingPastureId(null);
    }
  };

  // Clique no mapa para adicionar pasto ou reposicionar pasto ativo
  const handleMapClick = async (e: React.MouseEvent) => {
    // Se estiver no modo de reposicionamento de um pasto específico
    if (repositioningPastureId && viewportRef.current) {
      e.stopPropagation();
      const rect = viewportRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const rawX = 50 + ((clickX - rect.width / 2 - pan.x) / (rect.width * zoom)) * 100;
      const rawY = 50 + ((clickY - rect.height / 2 - pan.y) / (rect.height * zoom)) * 100;
      const x = Math.max(2, Math.min(98, Math.round(rawX)));
      const y = Math.max(2, Math.min(98, Math.round(rawY)));

      const target = pastures.find(p => p.id === repositioningPastureId);
      setPastures(prev => prev.map(p => p.id === repositioningPastureId ? { ...p, x, y } : p));
      await store.updatePasture(repositioningPastureId, { x, y });
      toast.success(`Pasto #${target?.number || ""} posicionado com sucesso no ponto clicado!`);
      setRepositioningPastureId(null);
      return;
    }

    if (isDragMode || isPanning || hasDragged || draggingPastureId) return;

    if (viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const rawX = 50 + ((clickX - rect.width / 2 - pan.x) / (rect.width * zoom)) * 100;
      const rawY = 50 + ((clickY - rect.height / 2 - pan.y) / (rect.height * zoom)) * 100;
      const x = Math.max(2, Math.min(98, Math.round(rawX)));
      const y = Math.max(2, Math.min(98, Math.round(rawY)));

      setClickCoordinates({ x, y });
      setPastureForm({
        id: "",
        number: String(pastures.length + 1).padStart(2, "0"),
        name: `Pasto ${String(pastures.length + 1).padStart(2, "0")}`,
        area_ha: "15",
        grass_type: "Brachiaria Marandu",
        status: "descanso",
        current_lot: "",
        capacity_ua: "25",
        water_source: "Bebedouro Australiano",
        notes: "",
        x,
        y,
        scale: markerScale
      });
      setShowAddModal(true);
    }
  };

  // Alterar tamanho individual de um pasto específico
  const updatePastureIndividualScale = async (pastureId: string, newScale: number) => {
    const clamped = Math.max(0.3, Math.min(1.5, Number(newScale.toFixed(2))));
    setPastures(prev => prev.map(p => p.id === pastureId ? { ...p, scale: clamped } : p));
    try {
      await store.updatePasture(pastureId, { scale: clamped });
    } catch (e) {
      console.error(e);
    }
  };

  // Abrir modal de edição de um pasto
  const openEditModal = (p: Pasture) => {
    setPastureForm({
      id: p.id,
      number: p.number,
      name: p.name,
      area_ha: String(p.area_ha),
      grass_type: p.grass_type,
      status: p.status,
      current_lot: p.current_lot || "",
      capacity_ua: String(p.capacity_ua || 25),
      water_source: p.water_source || "Bebedouro",
      notes: p.notes || "",
      x: p.x,
      y: p.y,
      scale: p.scale ?? markerScale
    });
    setShowAddModal(true);
  };

  // Salvar novo pasto ou edição
  const handleSavePasture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastureForm.number.trim() || !pastureForm.name.trim()) {
      toast.error("Informe o número e nome do pasto");
      return;
    }

    try {
      const area = parseFloat(pastureForm.area_ha) || 10;
      const capUa = parseFloat(pastureForm.capacity_ua) || 20;
      const posX = Math.max(2, Math.min(98, Math.round(Number(pastureForm.x) || clickCoordinates.x || 50)));
      const posY = Math.max(2, Math.min(98, Math.round(Number(pastureForm.y) || clickCoordinates.y || 50)));
      const pastureScale = Number(pastureForm.scale) || markerScale || 0.7;

      if (pastureForm.id) {
        await store.updatePasture(pastureForm.id, {
          number: pastureForm.number.trim(),
          name: pastureForm.name.trim(),
          area_ha: area,
          grass_type: pastureForm.grass_type,
          status: pastureForm.status,
          current_lot: pastureForm.status === "ocupado" ? pastureForm.current_lot : undefined,
          capacity_ua: capUa,
          water_source: pastureForm.water_source,
          notes: pastureForm.notes,
          x: posX,
          y: posY,
          scale: pastureScale
        });
        toast.success(`Pasto #${pastureForm.number} atualizado com sucesso!`);
      } else {
        const created = await store.addPasture({
          number: pastureForm.number.trim(),
          name: pastureForm.name.trim(),
          area_ha: area,
          grass_type: pastureForm.grass_type,
          status: pastureForm.status,
          current_lot: pastureForm.status === "ocupado" ? pastureForm.current_lot : undefined,
          capacity_ua: capUa,
          water_source: pastureForm.water_source,
          notes: pastureForm.notes,
          x: posX,
          y: posY,
          scale: pastureScale,
          rest_days: pastureForm.status === "descanso" ? 25 : 0
        });
        setSelectedPastureId(created.id);
        toast.success(`Pasto #${created.number} criado e posicionado no mapa!`);
      }

      setShowAddModal(false);
      await loadData();
    } catch (e) {
      toast.error("Erro ao salvar pasto");
    }
  };

  // Abrir diálogo de exclusão (sem window.confirm)
  const openDeleteDialog = (p: Pasture) => {
    setPastureToDelete(p);
    setShowDeleteDialog(true);
  };

  // Confirmar exclusão do pasto
  const confirmDelete = async () => {
    if (!pastureToDelete) return;
    const num = pastureToDelete.number;
    try {
      await store.deletePasture(pastureToDelete.id);
      setPastures(prev => prev.filter(p => p.id !== pastureToDelete.id));
      if (selectedPastureId === pastureToDelete.id) {
        setSelectedPastureId(null);
      }
      if (repositioningPastureId === pastureToDelete.id) {
        setRepositioningPastureId(null);
      }
      toast.success(`Pasto #${num} excluído com sucesso!`);
    } catch {
      toast.error("Erro ao excluir pasto");
    } finally {
      setShowDeleteDialog(false);
      setPastureToDelete(null);
    }
  };

  // Ajuste fino da posição do pasto (← → ↑ ↓)
  const nudgePasture = async (pastureId: string, dx: number, dy: number) => {
    const p = pastures.find(item => item.id === pastureId);
    if (!p) return;
    const newX = Math.max(2, Math.min(98, p.x + dx));
    const newY = Math.max(2, Math.min(98, p.y + dy));
    setPastures(prev => prev.map(item => item.id === pastureId ? { ...item, x: newX, y: newY } : item));
    await store.updatePasture(pastureId, { x: newX, y: newY });
  };

  // Mover Lote entre Pastos (Rotação)
  const handleMoveLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPasture || !moveLotForm.targetPastureId) {
      toast.error("Selecione o pasto de destino");
      return;
    }

    const target = pastures.find(p => p.id === moveLotForm.targetPastureId);
    if (!target) return;

    try {
      // 1. Libera o pasto de origem e coloca em descanso
      await store.updatePasture(selectedPasture.id, {
        status: "descanso",
        current_lot: undefined,
        rest_days: 1
      });

      // 2. Ocupa o pasto de destino com o lote
      await store.updatePasture(target.id, {
        status: "ocupado",
        current_lot: selectedPasture.current_lot,
        entry_date: new Date().toISOString().split("T")[0],
        rest_days: 0
      });

      // 3. Registra evento de manejo/rotação
      toast.success(`Lote "${selectedPasture.current_lot}" transferido do Pasto #${selectedPasture.number} para o Pasto #${target.number}!`);
      setShowMoveLotModal(false);
      setSelectedPastureId(target.id);
      await loadData();
    } catch (e) {
      toast.error("Erro ao rotacionar lote");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ocupado": return { bg: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-300", light: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-500", label: "Ocupado / Pastejo" };
      case "descanso": return { bg: "bg-blue-600", text: "text-blue-700 dark:text-blue-300", light: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-500", label: "Em Descanso" };
      case "vedado": return { bg: "bg-amber-600", text: "text-amber-700 dark:text-amber-300", light: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-500", label: "Vedado / Reserva" };
      default: return { bg: "bg-rose-600", text: "text-rose-700 dark:text-rose-300", light: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-500", label: "Em Reforma" };
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-16 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
              Mapeamento Aéreo & Pastejo
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-0.5 flex items-center gap-2">
            Pastos & Mapa de Satélite
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Visualize os piquetes na imagem do Google Earth, arraste os números e controle a lotação
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />

          <Button 
            variant="outline" 
            size="sm"
            onClick={handleResetImage}
            className="h-9 text-xs font-bold gap-1.5 shadow-sm border-emerald-500/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            title="Carrega a foto de satélite e os 9 piquetes da Fazenda Dois Irmãos"
          >
            <Check className="h-3.5 w-3.5 text-emerald-600" /> Foto Faz. Dois Irmãos
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 text-xs font-semibold gap-1.5 shadow-sm border-border/80 hover:bg-muted"
            title="Envie um print ou export do Google Earth da sua fazenda"
          >
            <Upload className="h-3.5 w-3.5 text-primary" /> Trocar Foto (Google Earth)
          </Button>

          <Button 
            variant={isDragMode ? "default" : "outline"} 
            size="sm"
            onClick={() => {
              setIsDragMode(!isDragMode);
              if (!isDragMode) {
                toast.info("Modo de edição: clique e arraste qualquer número de pasto na foto!");
              }
            }}
            className={`h-9 text-xs font-semibold gap-1.5 shadow-sm ${
              isDragMode ? "bg-amber-600 hover:bg-amber-700 text-white font-bold" : ""
            }`}
          >
            <Move className="h-3.5 w-3.5" /> 
            {isDragMode ? "Concluir Posições" : "Mover / Arrastar Pastos"}
          </Button>

          <Button 
            size="sm"
            onClick={() => {
              setClickCoordinates({ x: 50, y: 50 });
              setPastureForm({
                id: "",
                number: String(pastures.length + 1).padStart(2, "0"),
                name: `Pasto ${String(pastures.length + 1).padStart(2, "0")}`,
                area_ha: "15",
                grass_type: "Brachiaria Marandu",
                status: "descanso",
                current_lot: "",
                capacity_ua: "25",
                water_source: "Bebedouro Australiano",
                notes: ""
              });
              setShowAddModal(true);
            }}
            className="h-9 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> + Novo Pasto
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="border border-border/70 shadow-sm">
          <CardContent className="p-3.5">
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Área Total Pastagens</span>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-0.5 tabular-nums">
              {metrics.totalArea.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">ha</span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">{metrics.totalPastures} divisões cadastradas</span>
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-sm">
          <CardContent className="p-3.5">
            <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider block">Pastos Ocupados</span>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
              {metrics.occupied} <span className="text-xs font-normal text-muted-foreground">piquetes</span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">{metrics.totalAnimalsInPastures} animais em pastejo</span>
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-sm">
          <CardContent className="p-3.5">
            <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 tracking-wider block">Em Descanso / Vedados</span>
            <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">
              {metrics.resting + metrics.deferred} <span className="text-xs font-normal text-muted-foreground">piquetes</span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">{metrics.resting} em descanso · {metrics.deferred} vedados</span>
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-sm">
          <CardContent className="p-3.5">
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">Lotação Média</span>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-0.5 tabular-nums">
              {metrics.totalArea > 0 ? (metrics.totalAnimalsInPastures / metrics.totalArea).toFixed(2) : "0.00"}{" "}
              <span className="text-xs font-normal text-muted-foreground">cab/ha</span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">Eficiência de pastejo da fazenda</span>
          </CardContent>
        </Card>
      </div>

      {/* ÁREA PRINCIPAL: MAPA DE SATÉLITE + PAINEL DO PASTO SELECIONADO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* MAPA INTERATIVO (8 Colunas em desktop) */}
        <div className="lg:col-span-8 flex flex-col space-y-2">
          {/* Barra de Ferramentas do Mapa */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-card/80 backdrop-blur-sm p-2 rounded-xl border border-border/70 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[11px] font-bold gap-1 py-0.5 px-2 bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                <Compass className="h-3 w-3 text-emerald-600" />
                Faz. Dois Irmãos · Google Earth
              </Badge>
              {isDragMode && (
                <span className="text-[11px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1 animate-pulse">
                  <Move className="h-3 w-3" /> Arraste para reposicionar
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Controles de Formato do Rótulo do Pasto */}
              <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg border border-border/60">
                <span className="text-[10px] text-muted-foreground font-semibold px-1 hidden sm:inline">Rótulo:</span>
                <button
                  type="button"
                  onClick={() => updateMarkerStyle("compact")}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                    markerStyle === "compact" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Exibir rótulo compacto: Pasto 1"
                >
                  Pasto #
                </button>
                <button
                  type="button"
                  onClick={() => updateMarkerStyle("mini")}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                    markerStyle === "mini" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Exibir rótulo mini: P1"
                >
                  P#
                </button>
                <button
                  type="button"
                  onClick={() => updateMarkerStyle("number")}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                    markerStyle === "number" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Exibir apenas o número em um selo compacto: 1"
                >
                  #
                </button>
              </div>

              {/* Controle do Tamanho da Escrita e da Caixa */}
              <div className="flex items-center gap-1 bg-muted/60 px-1.5 py-0.5 rounded-lg border border-border/60">
                <span className="text-[10px] text-muted-foreground font-semibold hidden md:inline">Tamanho:</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-5 p-0 text-[11px] font-bold hover:bg-background"
                  onClick={() => changeMarkerScale(markerScale - 0.1)}
                  title="Diminuir tamanho da caixa e da escrita do pasto"
                >
                  A-
                </Button>
                <span className="text-[10px] font-mono font-bold w-7 text-center">
                  {Math.round(markerScale * 100)}%
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-5 p-0 text-[11px] font-bold hover:bg-background"
                  onClick={() => changeMarkerScale(markerScale + 0.1)}
                  title="Aumentar tamanho da caixa e da escrita do pasto"
                >
                  A+
                </Button>
                <input
                  type="range"
                  min="0.4"
                  max="1.3"
                  step="0.05"
                  value={markerScale}
                  onChange={(e) => changeMarkerScale(parseFloat(e.target.value))}
                  className="w-12 accent-emerald-600 cursor-pointer h-1.5 hidden xl:inline-block"
                  title="Deslize para ajustar o tamanho da caixa e do texto"
                />
              </div>

              {/* Botão de Auto-Compensação de Zoom */}
              <button
                type="button"
                onClick={() => setAutoScaleMarkers(!autoScaleMarkers)}
                className={`text-[10px] font-bold px-1.5 py-1 rounded-md border transition-colors ${
                  autoScaleMarkers 
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300" 
                    : "bg-muted/80 border-border/70 text-muted-foreground hover:text-foreground"
                }`}
                title={autoScaleMarkers ? "O tamanho dos marcadores fica proporcional ao dar zoom (não cobre o mapa)" : "Tamanho livre"}
              >
                {autoScaleMarkers ? "Zoom Fixo ✓" : "Zoom Fixo"}
              </button>

              {/* Toggle de Detalhes Hectares / Cabeças */}
              <Button
                variant={showMarkerDetails ? "default" : "outline"}
                size="sm"
                className="h-7 text-[10px] px-2 font-medium"
                onClick={() => setShowMarkerDetails(!showMarkerDetails)}
                title={showMarkerDetails ? "Ocultar área e cabeças dos marcadores" : "Mostrar área e cabeças nos marcadores"}
              >
                {showMarkerDetails ? "Ocultar info" : "+ info"}
              </Button>

              <div className="h-4 w-[1px] bg-border mx-0.5" />

              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={handleZoomIn} 
                title="Aproximar Zoom"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={handleZoomOut} 
                title="Afastar Zoom"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={handleResetView} 
                title="Resetar Posição e Zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <div className="h-4 w-[1px] bg-border mx-1" />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={handleResetImage}
                title="Restaurar imagem aérea inicial"
              >
                Restaurar Padrão
              </Button>
            </div>
          </div>

          {/* Container do Mapa e da Imagem de Satélite */}
          <div 
            ref={viewportRef}
            tabIndex={0}
            className={`relative w-full ${isExpanded ? "h-[740px]" : "h-[540px] sm:h-[600px]"} bg-slate-950 rounded-2xl overflow-hidden border-2 border-border/80 shadow-2xl select-none cursor-grab active:cursor-grabbing group transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") { panBy(100, 0); e.preventDefault(); }
              else if (e.key === "ArrowRight") { panBy(-100, 0); e.preventDefault(); }
              else if (e.key === "ArrowUp") { panBy(0, 100); e.preventDefault(); }
              else if (e.key === "ArrowDown") { panBy(0, -100); e.preventDefault(); }
              else if (e.key === "+" || e.key === "=") { handleZoomIn(); e.preventDefault(); }
              else if (e.key === "-") { handleZoomOut(); e.preventDefault(); }
              else if (e.key === "0" || e.key === "r") { handleResetView(); e.preventDefault(); }
            }}
          >
            {/* Camada móvel com Zoom e Pan (Apenas Imagem de Satélite e Grid) */}
            <div 
              ref={mapContainerRef}
              onClick={handleMapClick}
              className={`absolute inset-0 origin-center select-none ${
                isPanning ? "transition-none" : "transition-transform duration-150 ease-out"
              }`}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                backgroundImage: `url(${mapImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }}
            >
              {/* Overlay suave para legibilidade dos rótulos */}
              <div className="absolute inset-0 bg-black/15 pointer-events-none" />

              {/* Grid visual sutil de coordenadas agronômicas */}
              <div 
                className="absolute inset-0 opacity-15 pointer-events-none" 
                style={{
                  backgroundImage: "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                  backgroundSize: "80px 80px"
                }}
              />
            </div>

            {/* CAMADA DE MARCADORES (DESACOPLADA DO ZOOM PARA TEXTO 100% NÍTIDO E VETORIAL) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {pastureDetails.map((p) => {
                const isSelected = selectedPastureId === p.id;
                const isRepositioning = repositioningPastureId === p.id;
                const colors = getStatusColor(p.status);

                // Cálculo exato de posição de tela em pixels
                const markerLeft = (viewportSize.width / 2) + pan.x + ((p.x - 50) / 100) * viewportSize.width * zoom;
                const markerTop = (viewportSize.height / 2) + pan.y + ((p.y - 50) / 100) * viewportSize.height * zoom;

                // Escala individual com alta resolução nativa (sem blur de GPU)
                const individualScale = p.scale ?? markerScale;
                const finalScale = Number((individualScale * (isSelected ? 1.15 : 1)).toFixed(2));

                return (
                  <div
                    key={p.id}
                    onPointerDown={(e) => {
                      if (isDragMode) {
                        e.stopPropagation();
                        try {
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        } catch {}
                        setDraggingPastureId(p.id);
                        setSelectedPastureId(p.id);
                      }
                    }}
                    onPointerMove={(e) => {
                      if (draggingPastureId === p.id && viewportRef.current) {
                        e.stopPropagation();
                        const rect = viewportRef.current.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickY = e.clientY - rect.top;
                        const rawX = 50 + ((clickX - rect.width / 2 - pan.x) / (rect.width * zoom)) * 100;
                        const rawY = 50 + ((clickY - rect.height / 2 - pan.y) / (rect.height * zoom)) * 100;
                        const clampedX = Math.max(2, Math.min(98, Math.round(rawX)));
                        const clampedY = Math.max(2, Math.min(98, Math.round(rawY)));
                        setPastures(prev => prev.map(item => item.id === p.id ? { ...item, x: clampedX, y: clampedY } : item));
                      }
                    }}
                    onPointerUp={async (e) => {
                      if (draggingPastureId === p.id) {
                        e.stopPropagation();
                        try {
                          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                        } catch {}
                        setDraggingPastureId(null);
                        const current = pastures.find(item => item.id === p.id);
                        if (current) {
                          await store.updatePasture(p.id, { x: current.x, y: current.y });
                          toast.success(`Pasto #${p.number} reposicionado!`);
                        }
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (repositioningPastureId) return;
                      setSelectedPastureId(p.id);
                    }}
                    className={`absolute pointer-events-auto select-none z-20 group/pin ${
                      isPanning ? "transition-none" : "transition-[transform,opacity] duration-150"
                    } ${
                      isSelected ? "z-30 ring-2 ring-white shadow-xl" : ""
                    } ${isRepositioning ? "ring-2 ring-amber-400 z-40 animate-pulse" : ""} ${
                      isDragMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                    }`}
                    style={{
                      left: `${markerLeft}px`,
                      top: `${markerTop}px`,
                      transform: `translate(-50%, -50%) scale(${finalScale})`,
                      transformOrigin: "center center",
                      touchAction: isDragMode ? "none" : "auto",
                      WebkitFontSmoothing: "antialiased",
                      MozOsxFontSmoothing: "grayscale",
                      textRendering: "geometricPrecision"
                    }}
                  >
                    {/* Marcador Estilizado Compacto do Pasto */}
                    <div className="flex flex-col items-center">
                      <div className={`relative flex items-center justify-center rounded-full shadow-lg border-2 border-white ${
                        markerStyle === "number" ? "h-7 w-7 min-w-[28px] p-0" : "px-2.5 py-1"
                      } ${colors.bg} text-white font-extrabold transition-transform`}>
                        {/* Pulso sutil para pastos ocupados */}
                        {p.status === "ocupado" && (
                          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 ring-1 ring-white"></span>
                          </span>
                        )}

                        <span className="text-[12px] font-black tracking-tight flex items-center justify-center gap-1 leading-none drop-shadow-sm text-center">
                          {isDragMode && <Move className="h-3 w-3 animate-pulse" />}
                          {markerStyle === "number" 
                            ? p.number 
                            : markerStyle === "mini" 
                              ? `P${p.number}` 
                              : `Pasto ${p.number}`}
                        </span>
                      </div>

                      {/* Caixa de detalhes sob o pin */}
                      {(showMarkerDetails || isSelected) ? (
                        <div className="mt-1 bg-slate-950 text-white px-2 py-0.5 rounded-md text-[9px] font-bold border border-slate-700/90 whitespace-nowrap shadow-md flex items-center gap-1.5 pointer-events-none animate-in fade-in duration-150">
                          <span>{p.area_ha} ha</span>
                          <span className="text-slate-500 font-normal">|</span>
                          <span className={p.headCount > 0 ? "text-emerald-400 font-extrabold" : "text-slate-400"}>
                            {p.headCount > 0 ? `${p.headCount} cab` : "Vazio"}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1 bg-slate-950 text-white px-2 py-0.5 rounded-md text-[9px] font-bold border border-slate-700/90 whitespace-nowrap shadow-md opacity-0 group-hover/pin:opacity-100 transition-opacity flex items-center gap-1.5 pointer-events-none">
                          <span>{p.area_ha} ha</span>
                          <span className="text-slate-500 font-normal">|</span>
                          <span className={p.headCount > 0 ? "text-emerald-400 font-extrabold" : "text-slate-400"}>
                            {p.headCount > 0 ? `${p.headCount} cab` : "Vazio"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Aviso Flutuante de Reposicionamento Ativo */}
            {repositioningPastureId && (
              <div 
                className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-amber-950 px-4 py-2 rounded-full shadow-2xl border-2 border-white font-black text-xs flex items-center gap-2 animate-pulse"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Crosshair className="h-4 w-4" />
                <span>CLIQUE NA FOTO ONDE DESEJA COLOCAR O PASTO #{pastures.find(p => p.id === repositioningPastureId)?.number}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); setRepositioningPastureId(null); }}
                  className="h-6 px-2 text-[10px] bg-amber-950/20 hover:bg-amber-950/30 text-amber-950 font-bold rounded-full ml-1"
                >
                  Cancelar
                </Button>
              </div>
            )}

            {/* CONTROLES FLUTUANTES FIXOS SOBRE O MAPA */}

            {/* 1. D-Pad de Navegação Direcional (Arrastar para os Lados, Cima e Baixo) */}
            <div 
              className="absolute top-3 left-3 z-30 flex flex-col gap-1.5 bg-slate-950/85 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-2xl pointer-events-auto"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider text-center flex items-center justify-center gap-1">
                <Compass className="h-3 w-3 text-emerald-400" /> Navegar
              </div>
              
              <div className="grid grid-cols-3 gap-1 w-[96px] h-[96px] items-center justify-items-center bg-black/50 p-1 rounded-xl border border-white/10">
                <div />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); panBy(0, 100); }}
                  className="h-7 w-7 p-0 rounded-lg bg-white/10 hover:bg-emerald-600 text-white transition-colors"
                  title="Mover mapa para Cima"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <div />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); panBy(100, 0); }}
                  className="h-7 w-7 p-0 rounded-lg bg-white/10 hover:bg-emerald-600 text-white transition-colors"
                  title="Arrastar pro lado Esquerdo"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleResetView(); }}
                  className="h-7 w-7 p-0 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white transition-colors shadow-sm"
                  title="Centralizar mapa na Fazenda"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); panBy(-100, 0); }}
                  className="h-7 w-7 p-0 rounded-lg bg-white/10 hover:bg-emerald-600 text-white transition-colors"
                  title="Arrastar pro lado Direito"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <div />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); panBy(0, -100); }}
                  className="h-7 w-7 p-0 rounded-lg bg-white/10 hover:bg-emerald-600 text-white transition-colors"
                  title="Mover mapa para Baixo"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <div />
              </div>
            </div>

            {/* 2. Barra de Zoom Flutuante (Superior Direita) */}
            <div 
              className="absolute top-3 right-3 z-30 flex flex-col items-center gap-1.5 bg-slate-950/85 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-2xl pointer-events-auto"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
                className="h-8 w-8 p-0 rounded-xl bg-white/10 hover:bg-emerald-600 text-white transition-colors"
                title="Aproximar Zoom (+)"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>

              <div className="px-2 py-0.5 rounded-md bg-white/15 text-[11px] font-black text-white tabular-nums">
                {Math.round(zoom * 100)}%
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
                className="h-8 w-8 p-0 rounded-xl bg-white/10 hover:bg-emerald-600 text-white transition-colors"
                title="Afastar Zoom (-)"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>

              <div className="w-6 h-[1px] bg-white/20 my-0.5" />

              {/* Botões Rápidos de Nível de Zoom */}
              <div className="flex flex-col gap-1 w-full">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleSetZoom(1.0); }}
                  className={`text-[9px] font-bold py-1 px-1.5 rounded transition-colors text-center ${
                    zoom === 1.0 ? "bg-emerald-600 text-white shadow-sm" : "text-white/70 hover:bg-white/10"
                  }`}
                  title="Zoom 100%"
                >
                  1x
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleSetZoom(1.5); }}
                  className={`text-[9px] font-bold py-1 px-1.5 rounded transition-colors text-center ${
                    zoom === 1.5 ? "bg-emerald-600 text-white shadow-sm" : "text-white/70 hover:bg-white/10"
                  }`}
                  title="Zoom 150%"
                >
                  1.5x
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleSetZoom(2.0); }}
                  className={`text-[9px] font-bold py-1 px-1.5 rounded transition-colors text-center ${
                    zoom === 2.0 ? "bg-emerald-600 text-white shadow-sm" : "text-white/70 hover:bg-white/10"
                  }`}
                  title="Zoom 200%"
                >
                  2x
                </button>
              </div>

              <div className="w-6 h-[1px] bg-white/20 my-0.5" />

              {/* Botão de Expandir Altura */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                className="h-8 w-8 p-0 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title={isExpanded ? "Reduzir altura do mapa" : "Expandir mapa"}
              >
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {/* 3. Dica Flutuante no Rodapé com Atalhos de Gestos */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
              <div className="bg-slate-950/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 text-white text-[11px] font-semibold flex items-center gap-2 shadow-xl whitespace-nowrap">
                <Hand className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                <span>Arraste o mapa para os lados • Rolar o mouse dá zoom</span>
                <span className="hidden sm:inline bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-mono">
                  {Math.round(zoom * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PAINEL LATERAL: DETALHES DO PASTO SELECIONADO (4 Colunas) */}
        <div className="lg:col-span-4 space-y-4">
          {selectedPasture ? (
            <Card className="border border-border/80 shadow-md bg-card overflow-hidden">
              <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm text-white ${getStatusColor(selectedPasture.status).bg}`}>
                      #{selectedPasture.number}
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-foreground leading-none">
                        {selectedPasture.name}
                      </CardTitle>
                      <span className="text-xs text-muted-foreground mt-0.5 block">
                        Pasto #{selectedPasture.number} da propriedade
                      </span>
                    </div>
                  </div>

                  <Badge className={`${getStatusColor(selectedPasture.status).light} ${getStatusColor(selectedPasture.status).text} border ${getStatusColor(selectedPasture.status).border} text-[10px] font-bold`}>
                    {getStatusColor(selectedPasture.status).label}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4 text-xs">
                {/* Métricas do Pasto */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Área do Piquete</span>
                    <span className="text-lg font-black text-foreground">{selectedPasture.area_ha} ha</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Animais Alocados</span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {selectedPasture.headCount} <span className="text-xs font-normal text-muted-foreground">cab</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Lotação (UA/ha)</span>
                    <span className="text-lg font-black text-foreground">
                      {selectedPasture.stockingRate.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">UA/ha</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Capacidade Suportada</span>
                    <span className="text-lg font-black text-foreground">{selectedPasture.capacity_ua || 20} UA</span>
                  </div>
                </div>

                {/* Informações Forrageiras & Água */}
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Trees className="h-3.5 w-3.5 text-emerald-600" /> Espécie do Capim:
                    </span>
                    <span className="font-bold text-foreground">{selectedPasture.grass_type || "Brachiaria"}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-blue-600" /> Fonte de Água:
                    </span>
                    <span className="font-bold text-foreground">{selectedPasture.water_source || "Bebedouro"}</span>
                  </div>

                  {selectedPasture.status === "descanso" && (
                    <div className="flex justify-between items-center text-blue-600 font-semibold bg-blue-500/10 p-2 rounded-lg">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Dias em Descanso:
                      </span>
                      <span>{selectedPasture.rest_days || 0} dias</span>
                    </div>
                  )}

                  {selectedPasture.current_lot && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">Lote Ativo:</span>
                        <Badge className="bg-emerald-600 text-white font-bold text-xs">{selectedPasture.current_lot}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedPasture.headCount} animais pastando neste piquete.
                      </p>
                    </div>
                  )}
                </div>

                {/* Controles de Posição do Pasto no Mapa */}
                <div className="bg-muted/40 p-2.5 rounded-xl border border-border/70 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-1.5 text-foreground">
                      <Crosshair className="h-3.5 w-3.5 text-amber-600" /> Posição na Foto:
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground bg-background/80 px-2 py-0.5 rounded border">
                      X: {selectedPasture.x}% | Y: {selectedPasture.y}%
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRepositioningPastureId(selectedPasture.id);
                      toast.info(`Clique em qualquer ponto da foto de satélite para mover o Pasto #${selectedPasture.number}!`);
                    }}
                    className={`w-full h-8 text-xs font-bold gap-1.5 transition-colors ${
                      repositioningPastureId === selectedPasture.id 
                        ? "bg-amber-500 text-amber-950 border-amber-600 animate-pulse hover:bg-amber-400" 
                        : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                    }`}
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    {repositioningPastureId === selectedPasture.id ? "Clique no mapa para soltar" : "Mover Pasto (Clique no Mapa)"}
                  </Button>

                  <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground">
                    <span className="text-[10px]">Ajuste fino:</span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-xs font-bold" onClick={() => nudgePasture(selectedPasture.id, -2, 0)} title="Mover para esquerda">←</Button>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-xs font-bold" onClick={() => nudgePasture(selectedPasture.id, 2, 0)} title="Mover para direita">→</Button>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-xs font-bold" onClick={() => nudgePasture(selectedPasture.id, 0, -2)} title="Mover para cima">↑</Button>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-xs font-bold" onClick={() => nudgePasture(selectedPasture.id, 0, 2)} title="Mover para baixo">↓</Button>
                    </div>
                  </div>
                </div>

                {/* CONTROLE DE TAMANHO INDIVIDUAL DESTE PASTO */}
                <div className="bg-muted/40 p-2.5 rounded-xl border border-border/70 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-1.5 text-foreground">
                      <Maximize2 className="h-3.5 w-3.5 text-emerald-600" /> Tamanho Deste Pasto:
                    </span>
                    <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-background/80 px-2 py-0.5 rounded border">
                      {Math.round((selectedPasture.scale ?? markerScale) * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs font-bold hover:bg-background"
                      onClick={() => updatePastureIndividualScale(selectedPasture.id, (selectedPasture.scale ?? markerScale) - 0.1)}
                      title="Diminuir tamanho da escrita e da caixa deste pasto"
                    >
                      A- Menor
                    </Button>

                    <input
                      type="range"
                      min="0.3"
                      max="1.5"
                      step="0.05"
                      value={selectedPasture.scale ?? markerScale}
                      onChange={(e) => updatePastureIndividualScale(selectedPasture.id, parseFloat(e.target.value))}
                      className="flex-1 accent-emerald-600 cursor-pointer h-2 bg-muted rounded-lg"
                      title="Arraste para ajustar o tamanho da caixa e do texto"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs font-bold hover:bg-background"
                      onClick={() => updatePastureIndividualScale(selectedPasture.id, (selectedPasture.scale ?? markerScale) + 0.1)}
                      title="Aumentar tamanho da escrita e da caixa deste pasto"
                    >
                      A+ Maior
                    </Button>
                  </div>

                  {/* Atalhos Rápidos de Tamanho para o Pasto */}
                  <div className="grid grid-cols-4 gap-1 pt-1 text-[10px]">
                    {[
                      { label: "Mini", val: 0.45 },
                      { label: "Pequeno", val: 0.65 },
                      { label: "Médio", val: 0.85 },
                      { label: "Grande", val: 1.15 }
                    ].map(preset => {
                      const cur = selectedPasture.scale ?? markerScale;
                      const isActive = Math.abs(cur - preset.val) < 0.08;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => updatePastureIndividualScale(selectedPasture.id, preset.val)}
                          className={`py-1 px-1 rounded text-center font-bold border transition-colors ${
                            isActive
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                              : "bg-background/80 text-muted-foreground hover:text-foreground border-border/60 hover:bg-background"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ações do Pasto */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  {selectedPasture.current_lot && (
                    <Button 
                      className="w-full h-9 text-xs font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        setMoveLotForm({
                          targetPastureId: "",
                          lotName: selectedPasture.current_lot || ""
                        });
                        setShowMoveLotModal(true);
                      }}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Rotacionar / Mudar Lote de Pasto
                    </Button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-8 text-xs font-semibold hover:bg-muted"
                      onClick={() => openEditModal(selectedPasture)}
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1 text-primary" /> Editar Pasto
                    </Button>

                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-8 text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => openDeleteDialog(selectedPasture)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir Pasto
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-border/70 bg-card">
              <CardContent className="p-8 text-center flex flex-col items-center justify-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <MapPin className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-foreground text-sm">Selecione um Pasto</h3>
                <p className="text-xs text-muted-foreground">
                  Clique no marcador do pasto no mapa ou escolha na lista abaixo para editar, mover ou excluir.
                </p>
              </CardContent>
            </Card>
          )}

          {/* LISTA RÁPIDA DE TODOS OS PASTOS */}
          <Card className="border border-border/70 bg-card">
            <CardHeader className="p-3.5 pb-2 border-b border-border/50 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Todos os Pastos ({pastures.length})
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={() => {
                  setPastureForm({
                    id: "",
                    number: String(pastures.length + 1).padStart(2, "0"),
                    name: `Pasto ${String(pastures.length + 1).padStart(2, "0")}`,
                    area_ha: "15",
                    grass_type: "Brachiaria Marandu",
                    status: "descanso",
                    current_lot: "",
                    capacity_ua: "25",
                    water_source: "Bebedouro Australiano",
                    notes: "",
                    x: 50,
                    y: 50
                  });
                  setShowAddModal(true);
                }}
              >
                + Novo Pasto
              </Button>
            </CardHeader>
            <CardContent className="p-2 space-y-1 max-h-[290px] overflow-y-auto">
              {pastures.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Nenhum pasto cadastrado. Clique no botão acima para adicionar.
                </div>
              ) : (
                pastures.map(p => (
                  <div 
                    key={p.id}
                    onClick={() => setSelectedPastureId(p.id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all text-xs ${
                      selectedPastureId === p.id 
                        ? "bg-primary/10 border border-primary/40 font-bold" 
                        : "hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-1">
                      <span className={`h-6 w-6 shrink-0 rounded-md flex items-center justify-center font-black text-[10px] text-white ${getStatusColor(p.status).bg}`}>
                        {p.number}
                      </span>
                      <div className="truncate">
                        <div className="truncate text-foreground font-semibold leading-tight">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <span>{p.area_ha} ha · {p.status}</span>
                          <span className="text-emerald-700 dark:text-emerald-300 font-mono font-bold bg-emerald-500/10 px-1 rounded">
                            {Math.round((p.scale ?? markerScale) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Ajuste Rápido de Tamanho direto na lista */}
                      <div className="flex items-center bg-muted/60 rounded border border-border/60 mr-1">
                        <button
                          type="button"
                          className="h-6 w-5 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-background rounded-l"
                          onClick={(e) => {
                            e.stopPropagation();
                            updatePastureIndividualScale(p.id, (p.scale ?? markerScale) - 0.1);
                          }}
                          title="Diminuir tamanho deste pasto"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          className="h-6 w-5 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-background rounded-r"
                          onClick={(e) => {
                            e.stopPropagation();
                            updatePastureIndividualScale(p.id, (p.scale ?? markerScale) + 0.1);
                          }}
                          title="Aumentar tamanho deste pasto"
                        >
                          +
                        </button>
                      </div>

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                        title="Mover posição na foto"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPastureId(p.id);
                          setRepositioningPastureId(p.id);
                          toast.info(`Clique na foto onde deseja posicionar o Pasto #${p.number}!`);
                        }}
                      >
                        <Crosshair className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Editar dados"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(p);
                        }}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        title="Excluir este pasto"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteDialog(p);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL: NOVO / EDITAR PASTO */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-600" />
              {pastureForm.id ? `Editar Pasto #${pastureForm.number}` : "Cadastrar Novo Pasto"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSavePasture} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Número do Pasto *</Label>
                <Input 
                  placeholder="Ex: 01, 02..." 
                  value={pastureForm.number} 
                  onChange={e => setPastureForm({...pastureForm, number: e.target.value})}
                  className="h-10 text-sm font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Nome de Identificação *</Label>
                <Input 
                  placeholder="Ex: Pasto da Sede" 
                  value={pastureForm.name} 
                  onChange={e => setPastureForm({...pastureForm, name: e.target.value})}
                  className="h-10 text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Área Total (Hectares) *</Label>
                <Input 
                  type="number" 
                  step="0.1" 
                  placeholder="Ex: 15.5" 
                  value={pastureForm.area_ha} 
                  onChange={e => setPastureForm({...pastureForm, area_ha: e.target.value})}
                  className="h-10 text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Capacidade Estimada (UA)</Label>
                <Input 
                  type="number" 
                  placeholder="Ex: 25" 
                  value={pastureForm.capacity_ua} 
                  onChange={e => setPastureForm({...pastureForm, capacity_ua: e.target.value})}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Espécie Forrageira (Capim)</Label>
                <Input 
                  placeholder="Ex: Brachiaria Marandu, Mombaça..." 
                  value={pastureForm.grass_type} 
                  onChange={e => setPastureForm({...pastureForm, grass_type: e.target.value})}
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Status do Pasto</Label>
                <Select 
                  value={pastureForm.status} 
                  onValueChange={(val: any) => setPastureForm({...pastureForm, status: val})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ocupado">Ocupado / Em Pastejo</SelectItem>
                    <SelectItem value="descanso">Em Descanso / Recuperação</SelectItem>
                    <SelectItem value="vedado">Vedado / Reserva Seca</SelectItem>
                    <SelectItem value="reforma">Em Reforma / Adubação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {pastureForm.status === "ocupado" && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Lote de Animais Alocado</Label>
                <Select 
                  value={pastureForm.current_lot} 
                  onValueChange={(val) => setPastureForm({...pastureForm, current_lot: val})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione o lote de animais" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLots.map(l => (
                      <SelectItem key={l} value={l}>
                        Lote: {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Fonte de Água / Bebedouro</Label>
              <Input 
                placeholder="Ex: Bebedouro Australiano 10.000L, Açude" 
                value={pastureForm.water_source} 
                onChange={e => setPastureForm({...pastureForm, water_source: e.target.value})}
                className="h-10 text-sm"
              />
            </div>

            {/* Coordenadas e Posição do Pasto na Foto */}
            <div className="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-2">
              <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Posição na Foto da Fazenda
                </span>
                <span className="text-[11px] font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border">
                  X: {Math.round(pastureForm.x)}% | Y: {Math.round(pastureForm.y)}%
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Horizontal (Esquerda/Direita)</span>
                    <span>{Math.round(pastureForm.x)}%</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="98"
                    value={pastureForm.x}
                    onChange={(e) => setPastureForm({ ...pastureForm, x: Number(e.target.value) })}
                    className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-muted rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Vertical (Cima/Baixo)</span>
                    <span>{Math.round(pastureForm.y)}%</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="98"
                    value={pastureForm.y}
                    onChange={(e) => setPastureForm({ ...pastureForm, y: Number(e.target.value) })}
                    className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-muted rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Ajuste de Tamanho Individual Deste Pasto no Modal */}
            <div className="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Maximize2 className="h-3.5 w-3.5 text-emerald-600" /> Tamanho da Caixa e Escrita Deste Pasto
                </Label>
                <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-background px-2 py-0.5 rounded border">
                  {Math.round(pastureForm.scale * 100)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs font-bold"
                  onClick={() => setPastureForm({ ...pastureForm, scale: Math.max(0.3, Number((pastureForm.scale - 0.1).toFixed(2))) })}
                >
                  A- Menor
                </Button>
                <input
                  type="range"
                  min="0.3"
                  max="1.5"
                  step="0.05"
                  value={pastureForm.scale}
                  onChange={(e) => setPastureForm({ ...pastureForm, scale: parseFloat(e.target.value) })}
                  className="flex-1 accent-emerald-600 cursor-pointer h-2 bg-muted rounded-lg"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs font-bold"
                  onClick={() => setPastureForm({ ...pastureForm, scale: Math.min(1.5, Number((pastureForm.scale + 0.1).toFixed(2))) })}
                >
                  A+ Maior
                </Button>
              </div>

              {/* Pré-visualização do tamanho */}
              <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                <span>Prévia do marcador:</span>
                <div style={{ transform: `scale(${pastureForm.scale})`, transformOrigin: "right center" }}>
                  <div className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow border border-white">
                    Pasto {pastureForm.number || "01"}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Observações Adicionais</Label>
              <Input 
                placeholder="Ex: Perto do curral, adubado em novembro" 
                value={pastureForm.notes} 
                onChange={e => setPastureForm({...pastureForm, notes: e.target.value})}
                className="h-10 text-xs"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/50">
              {pastureForm.id ? (
                <Button 
                  type="button" 
                  variant="destructive" 
                  size="sm"
                  className="font-bold gap-1.5"
                  onClick={() => {
                    setShowAddModal(false);
                    const target = pastures.find(item => item.id === pastureForm.id);
                    if (target) {
                      openDeleteDialog(target);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir Pasto
                </Button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  Salvar Pasto
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: ROTACIONAR / MUDAR LOTE DE PASTO */}
      <Dialog open={showMoveLotModal} onOpenChange={setShowMoveLotModal}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
              Rotacionar Lote de Animais
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleMoveLot} className="space-y-4 py-2">
            <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs space-y-1">
              <p className="font-semibold text-foreground">Origem:</p>
              <p className="text-muted-foreground">
                Pasto <strong>#{selectedPasture?.number} - {selectedPasture?.name}</strong>
              </p>
              <p className="text-emerald-600 font-bold">
                Lote a transferir: {selectedPasture?.current_lot} ({selectedPasture?.headCount} animais)
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Pasto de Destino *
              </Label>
              <Select 
                value={moveLotForm.targetPastureId} 
                onValueChange={val => setMoveLotForm({...moveLotForm, targetPastureId: val})}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione o pasto de destino" />
                </SelectTrigger>
                <SelectContent>
                  {pastures
                    .filter(p => p.id !== selectedPasture?.id)
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        Pasto #{p.number} - {p.name} ({p.area_ha} ha · {p.status})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-[11px] text-muted-foreground">
              O pasto de origem entrará automaticamente em status de <strong>Descanso</strong> para recuperação do capim.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setShowMoveLotModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                Confirmar Rotação
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE PASTO */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5 text-destructive" />
              Excluir Pasto #{pastureToDelete?.number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <p className="text-foreground">
              Tem certeza que deseja excluir o <strong>Pasto #{pastureToDelete?.number} - {pastureToDelete?.name}</strong>?
            </p>

            <div className="p-3 bg-muted/60 rounded-xl border border-border/60 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Área Total:</span>
                <span className="font-bold">{pastureToDelete?.area_ha} hectares</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Espécie Forrageira:</span>
                <span className="font-bold">{pastureToDelete?.grass_type || "Brachiaria"}</span>
              </div>
              {pastureToDelete?.current_lot && (
                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-300 font-semibold text-xs">
                  ⚠️ Atenção: Este pasto possui o lote "{pastureToDelete.current_lot}" alocado.
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              O marcador será removido da imagem aérea e o registro será excluído da fazenda.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button type="button" variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              className="font-bold gap-1.5"
              onClick={confirmDelete}
            >
              <Trash2 className="h-4 w-4" /> Sim, Excluir Pasto
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
