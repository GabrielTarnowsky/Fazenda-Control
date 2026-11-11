import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScaleProtocol, SerialBaudRate, SerialConfig, StabilityConfig, DEFAULT_STABILITY_CONFIG, DEFAULT_SERIAL_CONFIG } from "@/services/scale/types";
import { Sliders, Cpu, Volume2, RotateCcw, Check, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ScaleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stabilityConfig: StabilityConfig;
  serialConfig: SerialConfig;
  onSave: (stability: StabilityConfig, serial: SerialConfig) => void;
}

export const ScaleSettingsModal: React.FC<ScaleSettingsModalProps> = ({
  isOpen,
  onClose,
  stabilityConfig,
  serialConfig,
  onSave
}) => {
  const [stability, setStability] = useState<StabilityConfig>({ ...stabilityConfig });
  const [serial, setSerial] = useState<SerialConfig>({ ...serialConfig });

  // Sincroniza quando o modal abre
  React.useEffect(() => {
    setStability({ ...stabilityConfig });
    setSerial({ ...serialConfig });
  }, [isOpen, stabilityConfig, serialConfig]);

  const handleResetDefaults = () => {
    setStability({ ...DEFAULT_STABILITY_CONFIG });
    setSerial({ ...DEFAULT_SERIAL_CONFIG });
    toast.info("Valores padrão de fábrica da Alfa 3102C.S restaurados");
  };

  const handleSave = () => {
    onSave(stability, serial);
    toast.success("Configurações da balança salvas com sucesso!");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-2 text-primary">
            <Sliders className="h-5 w-5" />
            <DialogTitle className="text-xl font-black italic tracking-tight">
              CONFIGURAÇÃO DA BALANÇA & CAPTURA
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground font-medium">
            Parâmetros de detecção de estabilidade e comunicação serial para o modelo Alfa Instrumentos 3102C.S
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="stability" className="mt-4">
          <TabsList className="grid grid-cols-2 w-full h-11 bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="stability" className="text-xs font-bold rounded-lg gap-2">
              <Sliders className="h-3.5 w-3.5" />
              Estabilidade & Captura
            </TabsTrigger>
            <TabsTrigger value="serial" className="text-xs font-bold rounded-lg gap-2">
              <Cpu className="h-3.5 w-3.5" />
              Porta Serial & Protocolo
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ESTABILIDADE E CAPTURA AUTOMÁTICA */}
          <TabsContent value="stability" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Tempo mínimo de estabilidade */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-card border shadow-sm">
                <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Tempo de Estabilidade</span>
                  <span className="text-primary font-black">{(stability.minStabilityTimeMs / 1000).toFixed(1)}s</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="5.0"
                    value={stability.minStabilityTimeMs / 1000}
                    onChange={(e) => setStability(s => ({
                      ...s,
                      minStabilityTimeMs: Math.max(500, Math.round((parseFloat(e.target.value) || 1.5) * 1000))
                    }))}
                    className="font-bold text-sm h-9"
                  />
                  <span className="text-xs text-muted-foreground font-semibold">seg</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Tempo contínuo que o animal precisa ficar parado para a balança travar a leitura.
                </p>
              </div>

              {/* Tolerância de oscilação */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-card border shadow-sm">
                <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Tolerância de Oscilação</span>
                  <span className="text-primary font-black">±{stability.toleranceKg.toFixed(1)} kg</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    min="0.2"
                    max="10.0"
                    value={stability.toleranceKg}
                    onChange={(e) => setStability(s => ({
                      ...s,
                      toleranceKg: Math.max(0.2, parseFloat(e.target.value) || 1.0)
                    }))}
                    className="font-bold text-sm h-9"
                  />
                  <span className="text-xs text-muted-foreground font-semibold">kg</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Variação máxima tolerada enquanto o animal respira ou apoia as patas.
                </p>
              </div>

              {/* Peso mínimo de detecção */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-card border shadow-sm">
                <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Peso Mínimo do Animal</span>
                  <span className="text-primary font-black">{stability.minWeightKg} kg</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="5"
                    min="10"
                    max="200"
                    value={stability.minWeightKg}
                    onChange={(e) => setStability(s => ({
                      ...s,
                      minWeightKg: Math.max(10, parseFloat(e.target.value) || 40.0)
                    }))}
                    className="font-bold text-sm h-9"
                  />
                  <span className="text-xs text-muted-foreground font-semibold">kg</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Ignora leituras abaixo desse valor (evita disparos falsos com sujeira ou ferramentas).
                </p>
              </div>

              {/* Limite de retorno a zero */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-card border shadow-sm">
                <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Retorno a Zero (Saída)</span>
                  <span className="text-primary font-black">&le; {stability.zeroReturnThresholdKg} kg</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="2"
                    min="2"
                    max="50"
                    value={stability.zeroReturnThresholdKg}
                    onChange={(e) => setStability(s => ({
                      ...s,
                      zeroReturnThresholdKg: Math.max(2, parseFloat(e.target.value) || 15.0)
                    }))}
                    className="font-bold text-sm h-9"
                  />
                  <span className="text-xs text-muted-foreground font-semibold">kg</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  O peso deve cair abaixo deste valor para liberar a pesagem do próximo animal.
                </p>
              </div>
            </div>

            {/* Switches de Comportamento */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Volume2 className="h-4 w-4 text-primary" />
                    <span>Aviso Sonoro de Confirmação (Bipe)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Emite bipe nítido quando a pesagem estabilizar e for gravada no animal.
                  </p>
                </div>
                <Switch
                  checked={stability.soundEnabled}
                  onCheckedChange={(checked) => setStability(s => ({ ...s, soundEnabled: checked }))}
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <span>Avançar Animal da Fila Automaticamente</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Ao zerar a plataforma após a pesagem, seleciona o próximo animal pendente do lote.
                  </p>
                </div>
                <Switch
                  checked={stability.autoAdvanceAnimal}
                  onCheckedChange={(checked) => setStability(s => ({ ...s, autoAdvanceAnimal: checked }))}
                />
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: PORTA SERIAL & PROTOCOLO */}
          <TabsContent value="serial" className="space-y-4 pt-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Balança Alfa Instrumentos 3102C.S:</strong> Por padrão de fábrica, utiliza comunicação serial RS-232 a <strong>9600 bps, 8 bits de dados, sem paridade (None) e 1 stop bit (8N1)</strong>. Protocolo recomendado: <strong>T02</strong> ou <strong>Auto-detectar</strong>.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Protocolo */}
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-bold text-foreground">Protocolo da Balança Alfa</Label>
                <Select 
                  value={serial.protocol} 
                  onValueChange={(val: ScaleProtocol) => setSerial(s => ({ ...s, protocol: val }))}
                >
                  <SelectTrigger className="font-bold text-xs h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alfa_trc">Alfa TRC - Transmissão Reduzida Contínua (Recomendado)</SelectItem>
                    <SelectItem value="alfa_t02">Alfa Instrumentos T02 Estrito (ST,GS,+00450.5kg)</SelectItem>
                    <SelectItem value="alfa_continuous">Alfa Contínuo Simples (ST 00450.5 kg)</SelectItem>
                    <SelectItem value="modbus_rtu">Modbus RTU Binário (Industrial RS-485/RS-232)</SelectItem>
                    <SelectItem value="modbus_ascii">Modbus ASCII (:0103...)</SelectItem>
                    <SelectItem value="generic_ascii">ASCII Genérico / Numérico</SelectItem>
                    <SelectItem value="auto_detect">Auto-detectar Inteligente</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  O modo TRC transmite o peso continuamente com quebra de linha CRLF.
                </p>
              </div>

              {/* Se Modbus estiver ativo, exibe campos configuráveis */}
              {(serial.protocol === "modbus_rtu" || serial.protocol === "modbus_ascii") && (
                <div className="md:col-span-2 p-3 bg-muted/40 border border-primary/20 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-primary">
                    <Cpu className="h-4 w-4" />
                    <span>Configuração do Mapa de Registradores Modbus</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Ajuste a posição dos registradores, formato dos bytes e escala conforme manual da Alfa 3102C.S:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold">Offset (Bytes)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="64"
                        value={serial.modbusConfig?.registerOffset ?? 0}
                        onChange={e => setSerial(s => ({
                          ...s,
                          modbusConfig: {
                            ...(s.modbusConfig || { slaveAddress: 1, functionCode: 3, registerOffset: 0, dataEncoding: "int32", byteOrder: "BE", scaleFactor: 0.1, hasStabilityField: false }),
                            registerOffset: Math.max(0, parseInt(e.target.value) || 0)
                          }
                        }))}
                        className="h-8 text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold">Formato de Dados</Label>
                      <Select
                        value={serial.modbusConfig?.dataEncoding || "int32"}
                        onValueChange={v => setSerial(s => ({
                          ...s,
                          modbusConfig: {
                            ...(s.modbusConfig || { slaveAddress: 1, functionCode: 3, registerOffset: 0, dataEncoding: "int32", byteOrder: "BE", scaleFactor: 0.1, hasStabilityField: false }),
                            dataEncoding: v as any
                          }
                        }))}
                      >
                        <SelectTrigger className="h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="int32">32-bit Inteiro (2 Regs)</SelectItem>
                          <SelectItem value="uint32">32-bit Unsigned</SelectItem>
                          <SelectItem value="float32">32-bit Float IEEE</SelectItem>
                          <SelectItem value="int16">16-bit Inteiro (1 Reg)</SelectItem>
                          <SelectItem value="uint16">16-bit Unsigned</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold">Ordem dos Bytes</Label>
                      <Select
                        value={serial.modbusConfig?.byteOrder || "BE"}
                        onValueChange={v => setSerial(s => ({
                          ...s,
                          modbusConfig: {
                            ...(s.modbusConfig || { slaveAddress: 1, functionCode: 3, registerOffset: 0, dataEncoding: "int32", byteOrder: "BE", scaleFactor: 0.1, hasStabilityField: false }),
                            byteOrder: v as any
                          }
                        }))}
                      >
                        <SelectTrigger className="h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BE">Big-Endian (ABCD)</SelectItem>
                          <SelectItem value="LE">Little-Endian (DCBA)</SelectItem>
                          <SelectItem value="CDAB">Mid-Big / Word swap (CDAB)</SelectItem>
                          <SelectItem value="BADC">Byte swap (BADC)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold">Fator de Escala</Label>
                      <Select
                        value={String(serial.modbusConfig?.scaleFactor ?? 0.1)}
                        onValueChange={v => setSerial(s => ({
                          ...s,
                          modbusConfig: {
                            ...(s.modbusConfig || { slaveAddress: 1, functionCode: 3, registerOffset: 0, dataEncoding: "int32", byteOrder: "BE", scaleFactor: 0.1, hasStabilityField: false }),
                            scaleFactor: parseFloat(v) || 1.0
                          }
                        }))}
                      >
                        <SelectTrigger className="h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.1">0.1 (÷ 10 - 1 decimal)</SelectItem>
                          <SelectItem value="0.01">0.01 (÷ 100 - 2 dec)</SelectItem>
                          <SelectItem value="1">1.0 (Direto em kg)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Baud Rate */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Taxa de Transmissão (Baud Rate)</Label>
                <Select 
                  value={String(serial.baudRate)} 
                  onValueChange={(val) => setSerial(s => ({ ...s, baudRate: Number(val) as SerialBaudRate }))}
                >
                  <SelectTrigger className="font-bold text-xs h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2400">2400 bps</SelectItem>
                    <SelectItem value="4800">4800 bps</SelectItem>
                    <SelectItem value="9600">9600 bps (Padrão Alfa)</SelectItem>
                    <SelectItem value="19200">19200 bps</SelectItem>
                    <SelectItem value="38400">38400 bps</SelectItem>
                    <SelectItem value="57600">57600 bps</SelectItem>
                    <SelectItem value="115200">115200 bps</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Deve coincidir com a configuração interna do indicador 3102C.S.
                </p>
              </div>

              {/* Data Bits & Stop Bits */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Data Bits / Stop Bits</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select 
                    value={String(serial.dataBits)} 
                    onValueChange={(val) => setSerial(s => ({ ...s, dataBits: Number(val) as any }))}
                  >
                    <SelectTrigger className="font-bold text-xs h-10">
                      <SelectValue placeholder="Data Bits" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">8 Data Bits</SelectItem>
                      <SelectItem value="7">7 Data Bits</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select 
                    value={String(serial.stopBits)} 
                    onValueChange={(val) => setSerial(s => ({ ...s, stopBits: Number(val) as any }))}
                  >
                    <SelectTrigger className="font-bold text-xs h-10">
                      <SelectValue placeholder="Stop Bits" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Stop Bit</SelectItem>
                      <SelectItem value="2">2 Stop Bits</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Paridade */}
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-bold text-foreground">Paridade</Label>
                <Select 
                  value={serial.parity} 
                  onValueChange={(val: any) => setSerial(s => ({ ...s, parity: val }))}
                >
                  <SelectTrigger className="font-bold text-xs h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (None - Padrão Alfa 3102C.S)</SelectItem>
                    <SelectItem value="even">Par (Even)</SelectItem>
                    <SelectItem value="odd">Ímpar (Odd)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="text-xs font-bold text-muted-foreground hover:text-foreground h-9 gap-1.5 w-full sm:w-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar Alfa 3102C.S
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs font-semibold h-9 flex-1 sm:flex-initial"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold h-9 gap-1.5 flex-1 sm:flex-initial"
            >
              <Check className="h-4 w-4" />
              Salvar Alterações
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
