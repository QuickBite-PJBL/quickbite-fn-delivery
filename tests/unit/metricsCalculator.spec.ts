import { describe, expect, it } from 'vitest';
import {
  buildGroupRecommendation,
  calculateStudyMetrics,
  resolvePaceStatus
} from '../../src/core/metricsCalculator';

describe('Motor de calculo analitico de produtividade dos Grupos de Estudo', () => {
  it('deve calcular corretamente as metricas globais e por grupo com alto desempenho', () => {
    const resultado = calculateStudyMetrics({
      groups: [
        {
          id: 'grp-ia-aplicada',
          name: 'Grupo Inteligencia Artificial Aplicada',
          subject: 'Aprendizado de Maquina',
          memberCount: 3,
          targetHours: 10
        }
      ],
      tasks: [
        {
          id: 'tsk-1',
          groupId: 'grp-ia-aplicada',
          title: 'Treinar modelo de classificacao supervisionada',
          completed: true,
          estimatedHours: 5
        },
        {
          id: 'tsk-2',
          groupId: 'grp-ia-aplicada',
          title: 'Avaliar matriz de confusao e acuracia do conjunto de validacao',
          completed: true,
          estimatedHours: 4
        },
        {
          id: 'tsk-3',
          groupId: 'grp-ia-aplicada',
          title: 'Escrever relatorio comparativo de hiperparametros',
          completed: true,
          estimatedHours: 3
        }
      ],
      messages: [
        {
          id: 'msg-1',
          groupId: 'grp-ia-aplicada',
          senderName: 'Rafael Souza',
          content: 'Modelo convergiu com 94% de precisao no dataset de testes!'
        },
        {
          id: 'msg-2',
          groupId: 'grp-ia-aplicada',
          senderName: 'Camila Ferreira',
          content: 'Adicionei os graficos de curva ROC no documento compartilhado.'
        },
        {
          id: 'msg-3',
          groupId: 'grp-ia-aplicada',
          senderName: 'Diego Martins',
          content: 'Revisei as conclusoes e deixei pronto para apresentacao.'
        },
        {
          id: 'msg-4',
          groupId: 'grp-ia-aplicada',
          senderName: 'Rafael Souza',
          content: 'Perfeito, equipe! Meta semanal batida com folga.'
        },
        {
          id: 'msg-5',
          groupId: 'grp-ia-aplicada',
          senderName: 'Camila Ferreira',
          content: 'Vamos preparar os slides hoje a noite.'
        },
        {
          id: 'msg-6',
          groupId: 'grp-ia-aplicada',
          senderName: 'Diego Martins',
          content: 'Combinado!'
        }
      ]
    });

    expect(resultado.overallCompletionRate).toBe(100);
    expect(resultado.totalEstimatedHours).toBe(12);
    expect(resultado.completedHours).toBe(12);
    expect(resultado.engagementScore).toBe(100);
    expect(resultado.studyPaceStatus).toBe('EXCELLENT');
    expect(resultado.paceLabel).toContain('Ritmo excelente');
    expect(resultado.groupBreakdown).toHaveLength(1);
    expect(resultado.groupBreakdown[0].recommendation).toContain('excelente desempenho');
    expect(new Date(resultado.calculatedAt).toString()).not.toBe('Invalid Date');
  });

  it('deve classificar como NEEDS_ATTENTION quando um grupo tiver baixa entrega e pouca interacao', () => {
    const resultado = calculateStudyMetrics({
      groups: [
        {
          id: 'grp-banco-dados',
          name: 'Grupo Modelagem de Banco de Dados',
          subject: 'Banco de Dados Relacional',
          memberCount: 4,
          targetHours: 12
        }
      ],
      tasks: [
        {
          id: 'tsk-10',
          groupId: 'grp-banco-dados',
          title: 'Normalizar esquema ate a terceira forma normal',
          completed: false,
          estimatedHours: 4
        },
        {
          id: 'tsk-11',
          groupId: 'grp-banco-dados',
          title: 'Criar indices compostos e analisar plano de execucao',
          completed: false,
          estimatedHours: 4
        },
        {
          id: 'tsk-12',
          groupId: 'grp-banco-dados',
          title: 'Escrever consultas SQL com funcoes de janela',
          completed: true,
          estimatedHours: 2
        }
      ],
      messages: []
    });

    expect(resultado.overallCompletionRate).toBe(33.33);
    expect(resultado.totalEstimatedHours).toBe(10);
    expect(resultado.completedHours).toBe(2);
    expect(resultado.studyPaceStatus).toBe('NEEDS_ATTENTION');
    expect(resultado.groupBreakdown[0].studyPaceStatus).toBe('NEEDS_ATTENTION');
    expect(resultado.groupBreakdown[0].recommendation).toContain('Atencao prioritaria');
  });

  it('deve consolidar multiplos grupos de estudo e inferir grupos presentes apenas nas tarefas', () => {
    const resultado = calculateStudyMetrics({
      groups: [
        {
          id: 'grp-engenharia-software',
          name: 'Grupo Engenharia de Software Agil',
          subject: 'Engenharia de Software',
          memberCount: 2,
          targetHours: 8
        }
      ],
      tasks: [
        {
          id: 'tsk-a1',
          groupId: 'grp-engenharia-software',
          title: 'Definir historias de usuario e criterios de aceite',
          completed: true,
          estimatedHours: 3
        },
        {
          id: 'tsk-a2',
          groupId: 'grp-engenharia-software',
          title: 'Elaborar diagrama de arquitetura em camadas',
          completed: false,
          estimatedHours: 3
        },
        {
          id: 'tsk-b1',
          groupId: 'grp-seguranca-redes',
          title: 'Analisar pacotes TLS e certificados digitais',
          completed: true
        }
      ],
      messages: [
        {
          id: 'msg-a1',
          groupId: 'grp-engenharia-software',
          senderName: 'Juliana Alves',
          content: 'Historias de usuario revisadas com o professor.'
        },
        {
          id: 'msg-a2',
          groupId: 'grp-engenharia-software',
          senderName: 'Bruno Cardoso',
          content: 'Iniciando o desenho dos componentes agora.'
        }
      ]
    });

    expect(resultado.groupBreakdown).toHaveLength(2);
    expect(resultado.totalEstimatedHours).toBe(8);
    expect(resultado.completedHours).toBe(5);
    expect(resultado.overallCompletionRate).toBe(66.67);

    const grupoInferido = resultado.groupBreakdown.find(
      (item) => item.groupId === 'grp-seguranca-redes'
    );
    expect(grupoInferido).toBeDefined();
    expect(grupoInferido?.groupName).toBe('Grupo grp-seguranca-redes');
    expect(grupoInferido?.completedHours).toBe(2);
  });

  it('deve lidar de forma segura com listas vazias sem lancar excecoes', () => {
    const resultado = calculateStudyMetrics({
      groups: [],
      tasks: [],
      messages: []
    });

    expect(resultado.overallCompletionRate).toBe(0);
    expect(resultado.totalEstimatedHours).toBe(0);
    expect(resultado.completedHours).toBe(0);
    expect(resultado.engagementScore).toBe(0);
    expect(resultado.studyPaceStatus).toBe('NEEDS_ATTENTION');
    expect(resultado.groupBreakdown).toEqual([]);
  });

  it('deve retornar recomendacoes e rotulos coerentes em portugues para cada faixa de ritmo', () => {
    const ritmoModerado = resolvePaceStatus(60, 55);
    expect(ritmoModerado.status).toBe('ON_TRACK');
    expect(ritmoModerado.label).toContain('Ritmo adequado');

    const recomendacaoPoucasMensagens = buildGroupRecommendation(
      'Grupo Calculo Numerico',
      75,
      0,
      6,
      8
    );
    expect(recomendacaoPoucasMensagens).toContain('melhorar o compartilhamento de duvidas');

    const recomendacaoPoucasTarefas = buildGroupRecommendation(
      'Grupo Sistemas Operacionais',
      45,
      5,
      4,
      10
    );
    expect(recomendacaoPoucasTarefas).toContain('precisa concluir as tarefas pendentes');
  });

  it('deve proteger contra payload nulo, indefinido ou grupos sem tarefas cadastradas', () => {
    const resultadoNulo = calculateStudyMetrics(null);
    expect(resultadoNulo.overallCompletionRate).toBe(0);
    expect(resultadoNulo.groupBreakdown).toHaveLength(0);

    const resultadoSemTarefas = calculateStudyMetrics({
      groups: [
        {
          id: 'grp-recem-criado',
          name: 'Grupo Compiladores e Automatos',
          subject: 'Teoria da Computacao',
          memberCount: 0,
          targetHours: -5
        }
      ],
      tasks: [],
      messages: [
        {
          id: 'msg-boas-vindas',
          groupId: 'grp-recem-criado',
          senderName: 'Fernanda Lima',
          content: 'Grupo criado! Vamos definir as tarefas da semana.'
        }
      ]
    });

    expect(resultadoSemTarefas.overallCompletionRate).toBe(0);
    expect(resultadoSemTarefas.groupBreakdown).toHaveLength(1);
    expect(resultadoSemTarefas.groupBreakdown[0].totalTasks).toBe(0);
    expect(resultadoSemTarefas.groupBreakdown[0].completionRate).toBe(0);
    expect(resultadoSemTarefas.groupBreakdown[0].memberCount).toBe(1);
    expect(resultadoSemTarefas.groupBreakdown[0].targetHours).toBe(10);
    expect(resultadoSemTarefas.groupBreakdown[0].recommendation).toContain(
      'ainda nao possui tarefas cadastradas'
    );
  });

  it('deve ignorar registros malformados e aplicar horas padrao quando estimativa for invalida', () => {
    const resultado = calculateStudyMetrics({
      groups: [
        {
          id: '   ',
          name: 'Grupo Invalido'
        },
        {
          id: 'grp-redes-computadores',
          name: 'Grupo Redes e Protocolos TCP/IP',
          subject: 'Redes de Computadores',
          memberCount: 3
        }
      ],
      tasks: [
        {
          id: 'tsk-horas-negativas',
          groupId: 'grp-redes-computadores',
          title: 'Configurar roteamento estatico no simulador',
          completed: true,
          estimatedHours: -4
        },
        {
          id: 'tsk-sem-grupo',
          groupId: '',
          title: 'Tarefa orfa que deve ser ignorada',
          completed: true,
          estimatedHours: 10
        }
      ],
      messages: null
    });

    expect(resultado.groupBreakdown).toHaveLength(1);
    expect(resultado.totalEstimatedHours).toBe(2);
    expect(resultado.completedHours).toBe(2);
    expect(resultado.overallCompletionRate).toBe(100);
  });
});
