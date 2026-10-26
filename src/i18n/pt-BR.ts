import type { TranslationKey } from "./en";

/** Brazilian Portuguese. Typed against `en.ts`: every key must exist here. */
export const ptBR: Record<TranslationKey, string> = {
  // ---- app ---------------------------------------------------------------
  "app.name": "Triare",
  "app.tagline": "Controle do triciclo de reabilitação",
  "common.notConnected": "Não conectado",

  // ---- language ----------------------------------------------------------
  "language.title": "Idioma",
  "language.hint":
    "O app inicia no idioma do celular. Sua escolha vale até o app ser fechado.",
  "language.a11y": "Idioma: {language}",

  // ---- tabs --------------------------------------------------------------
  "tabs.speed": "Velocidade",
  "tabs.resistance": "Resistência",
  "tabs.settings": "Ajustes",

  // ---- scan / connect screen ---------------------------------------------
  "home.connectLine1": "Conecte um triciclo",
  "home.connectLine2": "para iniciar uma sessão",
  "home.scanHelp":
    "Confirme que o dispositivo está ligado e por perto. A busca por Bluetooth fica ativa por um minuto.",
  "home.scanButton": "Buscar dispositivos",
  "home.availableDevices": "DISPOSITIVOS DISPONÍVEIS",
  "home.devicesFound_one": "{count} encontrado",
  "home.devicesFound_other": "{count} encontrados",
  "device.unknownName": "Desconhecido",
  "signal.strong": "Sinal forte",
  "signal.good": "Sinal bom",
  "signal.weak": "Sinal fraco",
  "signal.unknown": "Sinal desconhecido",

  // ---- connection --------------------------------------------------------
  "connection.scanFailed": "Falha na busca por BLE",
  "connection.deviceNotFound": "Dispositivo não encontrado",
  "connection.connectFailed": "Não foi possível conectar ao dispositivo",
  "connection.lostTitle": "Conexão perdida",
  "connection.lostBody":
    "A placa desconectou. Ligue-a e busque os dispositivos de novo para reconectar.",

  // ---- settings / resistance placeholders --------------------------------
  "settings.title": "Ajustes",
  "resistance.title": "Resistência",
  "resist.bench":
    "Teste de bancada: motor solto, corrente baixa. Deixe a mão pronta no eixo e o B3 ao alcance.",
  "resist.notArmed": "Toque em Habilitar primeiro. Os modos só funcionam com o sistema armado.",

  "resist.status.title": "O que a placa está fazendo",
  "resist.status.idle": "Nenhum modo de fisioterapia ativo.",
  "resist.mode.none": "Nenhum",
  "resist.mode.1": "Vale de assistência",
  "resist.mode.2": "Freio",
  "resist.mode.3": "Retenção estática",
  "resist.phase.0": "Parado",
  "resist.phase.1": "Em execução",
  "resist.phase.2": "Esperando o pedal parar",
  "resist.phase.3": "Segurando",
  "resist.phase.4": "Soltando",
  "resist.limit.thermal": "Corrente limitada: o motor está esquentando.",
  "resist.limit.yield": "A retenção cedeu porque o pedal foi forçado.",
  "resist.limit.timeout": "A retenção terminou: tempo máximo atingido.",
  "resist.metric.angle": "Ângulo do pedal",
  "resist.metric.current": "Corrente comandada",
  "resist.metric.assist": "Ajuda agora",
  "resist.metric.load": "Carga do motor",
  "resist.releaseNow": "Soltar agora",
  "resist.released": "Solto",
  "resist.ended": "Modo encerrado",

  "resist.setup.title": "Preparo",
  "resist.ratio.label": "Relação de transmissão",
  "resist.ratio.hint":
    "A retenção estática precisa de 3 ou mais. A caixa da bancada é 10:1. Ao ajustar, o ângulo do pedal é zerado.",
  "resist.ratio.set": "Ajustar relação",
  "resist.ratio.error": "Digite uma relação maior que 0.",
  "resist.leg.title": "Perna trabalhada",
  "resist.leg.left": "Esquerda",
  "resist.leg.right": "Direita",
  "resist.leg.hint":
    "As zonas são ângulos do pedal desta perna. O app converte para a placa.",

  "resist.pick.title": "Modo",
  "resist.pick.A.title": "Vale de assistência",
  "resist.pick.A.desc":
    "Mantém uma cadência constante e diminui a ajuda na parte fraca da volta.",
  "resist.pick.C.title": "Retenção estática",
  "resist.pick.C.desc":
    "Segura o pedal no lugar para trabalho isométrico. Cede se o pedal for forçado.",
  "resist.pick.B.title": "Freio",
  "resist.pick.B.desc": "Ainda indisponível: não há para onde enviar a energia da frenagem.",

  "resist.cadence.title": "Cadência",
  "resist.cadence.label": "RPM do pedivela",
  "resist.cadence.sentAs": "{erpm} ERPM no motor",
  "resist.cadence.error": "Digite uma cadência maior que 0.",
  "resist.zones.title": "Zonas com menos ajuda",
  "resist.zones.empty": "Nenhuma zona. A ajuda é igual em toda a volta.",
  "resist.zones.item": "Zona {n}",
  "resist.zones.start": "De (°)",
  "resist.zones.end": "Até (°)",
  "resist.zones.percent": "Ajuda (%)",
  "resist.zones.add": "Adicionar zona",
  "resist.zones.example": "Exemplo",
  "resist.zones.remove": "Remover",
  "resist.zones.send": "Enviar zonas",
  "resist.zones.read": "Ler da placa",
  "resist.zones.readResult_one": "{count} zona na placa.",
  "resist.zones.readResult_other": "{count} zonas na placa.",
  "resist.zones.readNone": "A placa não tem zonas.",
  "resist.zones.sent_one": "{count} zona enviada",
  "resist.zones.sent_other": "{count} zonas enviadas",
  "resist.zones.cleared": "Zonas apagadas na placa",
  "resist.zones.error.angle": "Os ângulos devem estar entre 0 e 360.",
  "resist.zones.error.length": "Uma zona precisa ter pelo menos 1°.",
  "resist.zones.error.percent": "A ajuda deve estar entre 0 e 100 %.",
  "resist.zones.error.edge": "A borda deve ser um número inteiro de 0 a 60.",
  "resist.zones.error.count": "Cabem 8 zonas.",
  "resist.map.title": "Ajuda ao longo da volta",
  "resist.map.legend": "Barras mais altas são mais ajuda. A linha vermelha é o pedal.",
  "resist.start": "Iniciar",
  "resist.end": "Encerrar modo",

  "resist.hold.title": "Corrente de retenção",
  "resist.hold.label": "Ampères (0,1 a 3)",
  "resist.hold.engage": "Segurar o pedal",
  "resist.hold.engaged": "Retenção pedida ({amps} A). Começa quando o pedal estiver parado.",
  "resist.hold.error": "Digite uma corrente entre 0,1 e 3 A.",
  "resist.hold.hint":
    "Pare o pedal com a mão ou deixe parar. A retenção nunca freia: se você empurrar demais, ela solta.",

  "resist.tune.title": "Ajuste fino (bancada)",
  "resist.tune.hint": "Mude um valor por vez. A placa recusa valores inseguros.",
  "resist.tune.kpSpeed": "Ganho de velocidade (P)",
  "resist.tune.kiSpeed": "Ganho de velocidade (I)",
  "resist.tune.kpPos": "Ganho de posição (P)",
  "resist.tune.kdPos": "Amortecimento de posição (D)",
  "resist.tune.send": "Enviar ganhos",
  "resist.tune.done": "Ganhos atualizados",
  "resist.tune.error": "Digite quatro números, 0 ou mais.",

  // ---- zero do pedal (tela de resistência) ---------------------------------
  "zero.title": "Zero do pedal",
  "zero.intro":
    "O sensor dá ao pedivela um zero fixo. Envie a relação de transmissão acima, marque o zero uma vez na instalação (pedal esquerdo para cima) e depois a placa o encontra sozinha a cada boot.",
  "zero.state.valid": "Zero confirmado pelo sensor",
  "zero.state.notValid": "Zero ainda não confirmado",
  "zero.state.searching": "O motor está girando os pedais…",
  "zero.state.learning": "Gire o pedivela, no sentido de pedalar, até o ímã passar pelo sensor.",
  "zero.state.unknown": "Lendo o estado do sensor…",
  "zero.check.ratio": "Relação enviada",
  "zero.check.index": "Zero marcado",
  "zero.check.saved": "Gravado na placa",
  "zero.check.rev": "Ré medida",
  "zero.metric.index": "Ângulo do sensor",
  "zero.metric.drift": "Último desvio",
  "zero.metric.pulses": "Pulsos",
  "zero.metric.slips": "Escorregamentos",
  "zero.result.title": "Última busca",
  "zero.result.0": "Nenhuma busca ainda",
  "zero.result.1": "Procurando…",
  "zero.result.2": "Achou: o sensor disparou",
  "zero.result.3": "Não achou: cerca de 1,25 volta sem pulso (sensor desligado ou desalinhado)",
  "zero.result.4": "O pedivela não se moveu (pé no pedal ou travado)",
  "zero.result.5": "O pedivela andou contra o sentido em que o sensor foi aprendido",
  "zero.result.6": "Interrompida antes de achar",
  "zero.result.7": "O resultado está desatualizado",
  "zero.learn": "Marcar zero (pedal esquerdo para cima)",
  "zero.learn.hint":
    "Deixe o pedal esquerdo para cima, toque e gire o pedivela no sentido de pedalar até o ímã passar pelo sensor. O pedivela precisa estar em movimento: pulso com ele parado é ignorado.",
  "zero.search": "Calibrar pedal",
  "zero.search.hint": "O motor gira o pedivela devagar até o sensor disparar. Mantenha os pés longe dos pedais.",
  "zero.cancel": "Cancelar busca",
  "zero.refresh": "Ler estado",
  "zero.confirm.title": "Mover os pedais?",
  "zero.confirm.body":
    "O motor vai girar o pedivela devagar (cerca de 8 rpm) por até 11 s. Mantenha pés e mãos longe dos pedais. Dá para cancelar a qualquer momento.",
  "zero.confirm.ok": "Iniciar",
  "zero.confirm.cancel": "Agora não",
  "zero.problem.noRatio": "Envie a relação de transmissão primeiro (Configuração acima).",
  "zero.problem.noIndex": "Marque o zero primeiro: pedal esquerdo para cima e gire o pedivela.",
  "zero.slow": "A busca está demorando mais do que a placa permite. Cancele e confira o sensor.",
  "zero.searchStarted": "Procurando o zero…",
  "zero.searchCancelled": "Busca do zero cancelada",

  // ---- command results (toasts) ------------------------------------------
  "motor.commandFailed": "Falha no comando BLE",
  "motor.armed": "Sistema armado",
  "motor.disarmed": "Sistema desarmado",
  "motor.released": "Motor liberado (roda livre)",
  "motor.speedSent": "Velocidade-alvo enviada: {rpm} RPM ({erpm} ERPM)",
  "motor.dutySet": "Duty definido em {duty}",
  "motor.crankZeroed": "Ângulo do pedivela zerado",
  "motor.ratioSet": "Relação de transmissão definida em {ratio}",
  "motor.emergencyPressed": "Parada de emergência acionada",
  "motor.emergencyPressedDetail":
    "O motor foi liberado. Solte o B3 e mantenha-o solto por 2 s para limpar a parada (ou toque em Habilitar).",
  "motor.emergencyCleared": "Parada de emergência liberada",
  "motor.emergencyClearedDetail":
    "O sistema está desarmado. Toque em Habilitar quando for seguro armar.",
  "motor.selfDisarmed": "A placa se desarmou sozinha",
  "motor.selfDisarmedDetail":
    "Veja a falha do controlador na telemetria e depois toque em Habilitar.",
  "toast.enable": "Habilitar",

  "feedback.disarmed.title": "O sistema está desarmado",
  "feedback.disarmed.detail": "Toque em Habilitar primeiro e depois envie a velocidade.",
  "feedback.emergency.title": "Parada de emergência ativa",
  "feedback.emergency.detail":
    "Solte o B3 e mantenha-o solto por 2 s para limpar a parada (ou toque em Habilitar).",
  "feedback.emergency.stillPressed":
    "O botão B3 ainda está pressionado. Solte-o e toque em Habilitar de novo.",
  "feedback.fault.title": "Falha no controlador do motor",
  "feedback.fault.detail":
    "Armar e movimentar ficam bloqueados enquanto o VESC informa uma falha. Verifique o controlador, desligue e ligue a placa e reconecte.",
  "feedback.invalid.title": "Valor rejeitado pelo firmware",
  "feedback.invalid.detail": "Confira o valor e tente de novo.",
  "feedback.invalid.hold":
    "A retenção precisa de uma corrente de 0,1 a 3 A e de uma relação de transmissão de 3 ou mais.",
  "feedback.invalid.zeroSearch":
    "A busca do zero precisa do sistema armado, de uma relação de transmissão e do sensor aprendido, e o motor deve estar parado.",
  "feedback.noRegen.title": "O freio não está disponível",
  "feedback.noRegen.detail": "Ainda não há para onde enviar a energia da frenagem.",
  "feedback.zeroSetup.title": "O zero não está configurado",
  "feedback.zeroSetup.detail": "Envie a relação de transmissão e marque o zero primeiro; depois procure de novo.",
  "feedback.rejected.title": "Comando rejeitado pelo firmware",
  "feedback.rejected.detail": "Código do motivo: 0x{code}.",
  "feedback.rangeError": "Valor inválido",
  "feedback.timeout.title": "Sem resposta da placa",
  "feedback.timeout.motion":
    "Provavelmente o sistema está desarmado ou há uma parada de emergência ativa. Toque em Habilitar e envie a velocidade de novo.",
  "feedback.timeout.enable":
    "A habilitação não foi confirmada. O botão B3 pode estar pressionado ou o controlador pode estar em falha; verifique a placa e tente de novo.",
  "feedback.timeout.ratio":
    "A relação pode ser inválida (deve ser maior que 0) ou o enlace está instável.",
  "feedback.timeout.stop":
    "O comando pode ou não ter sido aplicado. Confirme que o motor parou e aperte Emergência (B3) se não parou.",
  "feedback.timeout.zero":
    "A placa não respondeu. Pode estar desarmada ou com um firmware antigo, sem a busca do zero.",
  "feedback.timeout.default": "Verifique a conexão e tente de novo.",
  "feedback.timeout.resist":
    "A placa não respondeu. Pode estar desarmada ou com um firmware antigo, sem este modo.",

  // ---- speed screen ------------------------------------------------------
  "state.unknown.label": "Estado desconhecido",
  "state.unknown.hint": "Aguardando a placa informar o estado…",
  "state.unknown.legacyHint":
    "Este firmware não informa o estado. Atualize-o para ver o estado ao vivo, ou toque em Habilitar / Desabilitar.",
  "state.armed.label": "Armado",
  "state.armed.hint": "Motor liberado. Envie uma velocidade ou duty para iniciar.",
  "state.running.label": "Em movimento",
  "state.running.hint": "Há uma velocidade ou duty ativo. Parar libera o motor.",
  "state.disarmed.label": "Desarmado",
  "state.disarmed.hint": "Toque em Habilitar antes de enviar uma velocidade.",
  "state.emergency.label": "Parada de emergência",
  "state.emergency.hint":
    "Solte o B3 e mantenha-o solto por 2 s para limpar a parada (ou toque em Habilitar).",

  "speed.system": "Sistema",
  "speed.enable": "Habilitar",
  "speed.disable": "Desabilitar",
  "speed.stop": "Parar",
  "speed.targetTitle": "Velocidade-alvo (RPM do motor)",
  "speed.setSpeed": "Definir velocidade",
  "speed.sentAs": "Enviado ao firmware como {erpm} ERPM (RPM × 4). Pedal ≈ {crank} RPM.",
  "speed.dutyTitle": "Duty (-1,0 a 1,0)",
  "speed.setDuty": "Definir duty",
  "speed.ratioTitle": "Pedivela / relação de transmissão",
  "speed.calibrate": "Calibrar pedivela",
  "speed.setRatio": "Definir relação",
  "speed.error.rpm": "Digite a velocidade como número (RPM do motor).",
  "speed.error.duty": "O duty deve ser um número entre -1,0 e 1,0.",
  "speed.error.ratio": "A relação de transmissão deve ser um número maior que 0.",
  "speed.telemetry": "Telemetria",
  "speed.live": "Telemetria ao vivo e mostrador do pedal ({mode})",
  "speed.mode.streamed": "enviada pela placa, 20 Hz",
  "speed.mode.polled": "consultada, ~7 Hz",
  "speed.mode.starting": "iniciando…",
  "speed.liveHint":
    "O estado acima se atualiza sozinho; este botão só atualiza os números e o mostrador. Ele também pede um enlace Bluetooth mais rápido, então deixe-o desligado quando não precisar.",
  "speed.liveStopped": "A telemetria ao vivo parou.",
  "speed.liveStoppedWithReason": "A telemetria ao vivo parou: {reason}.",
  "speed.retry": "Tentar de novo",
  "speed.requestTelemetry": "Pedir telemetria",
  "speed.deveui": "DevEUI",
  "speed.readDeveui": "Ler DevEUI",
  "speed.deveuiFailed": "Falha ao ler o DevEUI",
  "speed.connection": "Conexão",
  "speed.disconnect": "Desconectar",

  // ---- pedal dial and units ----------------------------------------------
  "dial.position": "Posição do pedal {angle}",
  "dial.unavailable": "Posição do pedal indisponível",
  "dial.left": "Esquerdo",
  "dial.right": "Direito",
  "unit.erpm": "ERPM",
  "unit.motorRpm": "RPM do motor",
  "unit.crankRpm": "RPM do pedivela",

  // ---- telemetry panel ---------------------------------------------------
  "telemetry.waiting": "Aguardando a primeira amostra…",
  "telemetry.turnOn": "Ligue a telemetria ao vivo para ver as medições e a tendência.",
  "tile.showHint": "Mostra o que isto significa",
  "tile.hideHint": "Esconde a explicação",
  "level.ok": "normal",
  "level.warn": "atenção",
  "level.danger": "fora da faixa",

  "tile.speed.label": "Velocidade do pedal",
  "tile.speed.detail": "Motor {motor} RPM · {erpm} ERPM",
  "tile.speed.hint":
    "Quão rápido os pedais giram. Negativo significa sentido reverso. O motor gira mais rápido que os pedais, na proporção da relação de transmissão (definida em 'Pedivela / relação de transmissão'). ERPM é a unidade do controlador do motor: RPM do motor × 4 pares de polos.",
  "tile.speed.chart": "Velocidade do pedal nos últimos 30 segundos",
  "tile.current.label": "Corrente do motor",
  "tile.current.hint":
    "Corrente no motor. Positiva: o motor está empurrando. Negativa: está freando e devolvendo energia à alimentação, o que eleva a tensão. Um aumento súbito com velocidade constante indica mais carga.",
  "tile.current.chart": "Corrente do motor nos últimos 30 segundos",
  "tile.voltage.label": "Tensão de alimentação",
  "tile.voltage.hint":
    "Tensão no controlador. Abaixo de 22 V a bateria está baixa e o controlador corta a potência perto de 20 V. Acima de 28 V a frenagem é limitada, e 30 V é o máximo. Com fonte de bancada, a frenagem pode elevar isso rapidamente.",
  "tile.voltage.chart": "Tensão de alimentação nos últimos 30 segundos",
  "tile.temp.label": "Temp. do controlador",
  "tile.temp.hint":
    "Temperatura dos transistores de potência (FET) do controlador. Sobe com a corrente. Perto de 85 °C o controlador reduz a potência sozinho.",
  "tile.temp.chart": "Temperatura do controlador nos últimos 30 segundos",
  "tile.fault.label": "Falha do controlador",
  "tile.fault.okHint":
    "O controlador do motor (VESC) não informa falha. Uma falha corta o motor e bloqueia o armamento até ser limpa.",
  "tile.fault.withCode": "{hint} Código {code}.",

  "fault.none.name": "Sem falha",
  "fault.none.hint": "O controlador do motor não informa falha.",
  "fault.unknown.name": "Código de falha {code}",
  "fault.unknown.hint":
    "Veja a lista de falhas da versão do firmware do VESC no VESC Tool.",
  "fault.1.name": "Sobretensão",
  "fault.1.hint":
    "A tensão de alimentação passou do limite. A frenagem devolve energia à alimentação, e uma fonte de bancada não consegue absorvê-la.",
  "fault.2.name": "Subtensão",
  "fault.2.hint":
    "A tensão de alimentação caiu abaixo do corte. Verifique a carga da bateria ou o limite de corrente da fonte.",
  "fault.3.name": "Falha no driver de gate",
  "fault.3.hint":
    "O chip driver do motor informou uma falha. Desligue e ligue e confira a fiação das fases.",
  "fault.4.name": "Sobrecorrente",
  "fault.4.hint": "A corrente passou do limite do hardware.",
  "fault.5.name": "Controlador muito quente",
  "fault.5.hint":
    "Os transistores de potência (FET) estão acima do limite de temperatura. Deixe esfriar.",
  "fault.6.name": "Motor muito quente",
  "fault.6.hint": "O sensor de temperatura do motor está acima do limite.",
  "fault.7.name": "Sobretensão no driver de gate",
  "fault.7.hint": "A alimentação do driver está alta demais.",
  "fault.8.name": "Subtensão no driver de gate",
  "fault.8.hint": "A alimentação do driver está baixa demais.",
  "fault.9.name": "Subtensão na lógica do controlador",
  "fault.9.hint": "A alimentação de 3,3 V do próprio controlador caiu.",
  "fault.10.name": "Reiniciado pelo watchdog",
  "fault.10.hint": "O controlador reiniciou sozinho depois de travar.",
  "fault.11.name": "Falha no SPI do encoder",
  "fault.11.hint": "O sensor de posição não respondeu.",
  "fault.12.name": "Amplitude do encoder seno/cosseno muito baixa",
  "fault.12.hint": "Confira a fiação do sensor de posição.",
  "fault.13.name": "Amplitude do encoder seno/cosseno muito alta",
  "fault.13.hint": "Confira a fiação do sensor de posição.",
};
