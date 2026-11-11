import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BalancaSerial } from '../balanca-serial';

describe('BalancaSerial', () => {
  let balanca: BalancaSerial;

  beforeEach(() => {
    vi.useFakeTimers();
    balanca = new BalancaSerial({
      baudRate: 9600,
      toleranciaKg: 0.5,
      janelaEstavelMs: 1000,
      pesoMinimoKg: 5,
    });
  });

  it('extrai peso formatado em ponto decimal', () => {
    const onPesoSpy = vi.fn();
    balanca.onPeso = onPesoSpy;

    balanca.injetar('ST,GS,  452.3kg\r\n');

    expect(onPesoSpy).toHaveBeenCalledWith({
      kg: 452.3,
      estavel: false,
    });
    expect(balanca.ultimoKg).toBe(452.3);
  });

  it('extrai peso formatado com vírgula', () => {
    const onPesoSpy = vi.fn();
    balanca.onPeso = onPesoSpy;

    balanca.injetar('PESO: 380,5 KG\r\n');

    expect(onPesoSpy).toHaveBeenCalledWith({
      kg: 380.5,
      estavel: false,
    });
    expect(balanca.ultimoKg).toBe(380.5);
  });

  it('dispara onEstavel exatamente uma vez quando o peso estabiliza na janela de tempo', () => {
    const onEstavelSpy = vi.fn();
    balanca.onEstavel = onEstavelSpy;

    // Leitura 1: 450.0 kg no tempo 0
    balanca.injetar('ST,GS,  450.0kg\r\n');
    expect(onEstavelSpy).not.toHaveBeenCalled();

    // Avança 500ms
    vi.advanceTimersByTime(500);
    balanca.injetar('ST,GS,  450.2kg\r\n');
    expect(onEstavelSpy).not.toHaveBeenCalled();

    // Avança mais 400ms (total 900ms >= 800ms) com 3 leituras dentro da tolerância de 0.5kg
    vi.advanceTimersByTime(400);
    balanca.injetar('ST,GS,  450.1kg\r\n');

    // Agora deve ter detectado estabilidade e disparado onEstavel com a média (450.1)
    expect(onEstavelSpy).toHaveBeenCalledTimes(1);
    expect(onEstavelSpy).toHaveBeenCalledWith(450.1);
    expect(balanca.estavel).toBe(true);

    // Nova leitura estável não dispara onEstavel novamente enquanto o boi ainda estiver em cima
    vi.advanceTimersByTime(200);
    balanca.injetar('ST,GS,  450.1kg\r\n');
    expect(onEstavelSpy).toHaveBeenCalledTimes(1);

    // Animal desce da balança (peso < 5kg)
    vi.advanceTimersByTime(200);
    balanca.injetar('ST,GS,  0.0kg\r\n');
    expect(balanca.estavel).toBe(false);

    // Próximo animal sobe na balança (peso 512.0kg)
    vi.advanceTimersByTime(500);
    balanca.injetar('ST,GS,  512.0kg\r\n');
    vi.advanceTimersByTime(500);
    balanca.injetar('ST,GS,  512.2kg\r\n');
    vi.advanceTimersByTime(400);
    balanca.injetar('ST,GS,  512.1kg\r\n');

    // Deve disparar onEstavel para o segundo animal!
    expect(onEstavelSpy).toHaveBeenCalledTimes(2);
    expect(onEstavelSpy).toHaveBeenLastCalledWith(512.1);
  });

  it('não dispara onEstavel se houver oscilação acima da tolerância', () => {
    const onEstavelSpy = vi.fn();
    balanca.onEstavel = onEstavelSpy;

    balanca.injetar('ST,GS,  450.0kg\r\n');
    vi.advanceTimersByTime(500);
    balanca.injetar('ST,GS,  453.0kg\r\n'); // oscilou 3kg (tolerancia = 0.5kg)
    vi.advanceTimersByTime(400);
    balanca.injetar('ST,GS,  451.5kg\r\n');

    expect(onEstavelSpy).not.toHaveBeenCalled();
    expect(balanca.estavel).toBe(false);
  });

  it('extrai peso mesmo com endereço de dispositivo no início (ex.: 01, 450 kg)', () => {
    const onPesoSpy = vi.fn();
    balanca.onPeso = onPesoSpy;

    balanca.injetar('01,ST,GS,  450kg\r\n');

    expect(onPesoSpy).toHaveBeenCalledWith({
      kg: 450,
      estavel: false,
    });
    expect(balanca.ultimoKg).toBe(450);
  });

  it('extrai peso negativo quando a balança estiver descalibrada ou com tara negativa', () => {
    const onPesoSpy = vi.fn();
    balanca.onPeso = onPesoSpy;

    balanca.injetar('ST,GS, -00001.5kg\r\n');

    expect(onPesoSpy).toHaveBeenCalledWith({
      kg: -1.5,
      estavel: false,
    });
    expect(balanca.ultimoKg).toBe(-1.5);
  });

  it('desconecta liberando recursos sem lançar erros', async () => {
    await balanca.desconectar();
    expect(balanca.port).toBeNull();
    expect(balanca.reader).toBeNull();
    expect(balanca.estavel).toBe(false);
  });
});
