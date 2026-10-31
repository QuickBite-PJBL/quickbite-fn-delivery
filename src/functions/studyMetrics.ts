import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  calculateStudyMetrics,
  MetricsCalculationInput,
  StudyGroupInput,
  StudyMessageInput,
  StudyTaskInput
} from '../core/metricsCalculator';

function buildDemoPortugueseDataset(groupIdFilter?: string): MetricsCalculationInput {
  const demoGroups: StudyGroupInput[] = [
    {
      id: 'grp-arquitetura-nuvem',
      name: 'Grupo Arquitetura em Nuvem e Serverless',
      subject: 'Computacao em Nuvem',
      memberCount: 4,
      targetHours: 12
    },
    {
      id: 'grp-estruturas-dados',
      name: 'Grupo Algoritmos e Estruturas de Dados',
      subject: 'Estruturas de Dados Avancadas',
      memberCount: 3,
      targetHours: 10
    }
  ];

  const demoTasks: StudyTaskInput[] = [
    {
      id: 'tsk-101',
      groupId: 'grp-arquitetura-nuvem',
      title: 'Implementar HTTP Trigger no Azure Functions v4',
      completed: true,
      estimatedHours: 4
    },
    {
      id: 'tsk-102',
      groupId: 'grp-arquitetura-nuvem',
      title: 'Configurar pipeline de testes automatizados com Vitest',
      completed: true,
      estimatedHours: 3
    },
    {
      id: 'tsk-103',
      groupId: 'grp-arquitetura-nuvem',
      title: 'Documentar variaveis de ambiente e deploy serverless',
      completed: true,
      estimatedHours: 2.5
    },
    {
      id: 'tsk-201',
      groupId: 'grp-estruturas-dados',
      title: 'Resolver lista de arvores balanceadas AVL',
      completed: true,
      estimatedHours: 3
    },
    {
      id: 'tsk-202',
      groupId: 'grp-estruturas-dados',
      title: 'Implementar grafo direcionado com busca em largura',
      completed: false,
      estimatedHours: 4
    }
  ];

  const demoMessages: StudyMessageInput[] = [
    {
      id: 'msg-01',
      groupId: 'grp-arquitetura-nuvem',
      senderName: 'Ana Clara',
      content: 'Pessoal, finalizei os testes da funcao de metricas no Azure Functions!'
    },
    {
      id: 'msg-02',
      groupId: 'grp-arquitetura-nuvem',
      senderName: 'Lucas Mendes',
      content: 'Excelente! Vou revisar o calculo do indice de engajamento hoje a noite.'
    },
    {
      id: 'msg-03',
      groupId: 'grp-arquitetura-nuvem',
      senderName: 'Beatriz Rocha',
      content: 'Subi os exemplos de requisicao POST para validarmos juntos.'
    },
    {
      id: 'msg-04',
      groupId: 'grp-arquitetura-nuvem',
      senderName: 'Pedro Henrique',
      content: 'Tudo pronto para a entrega do sprint!'
    },
    {
      id: 'msg-05',
      groupId: 'grp-estruturas-dados',
      senderName: 'Mariana Costa',
      content: 'Alguem pode ajudar na rotacao dupla da arvore AVL?'
    }
  ];

  if (groupIdFilter && groupIdFilter.trim() !== '') {
    const normalizedFilter = groupIdFilter.trim();
    return {
      groups: demoGroups.filter((group) => group.id === normalizedFilter),
      tasks: demoTasks.filter((task) => task.groupId === normalizedFilter),
      messages: demoMessages.filter((message) => message.groupId === normalizedFilter)
    };
  }

  return {
    groups: demoGroups,
    tasks: demoTasks,
    messages: demoMessages
  };
}

export async function studyMetricsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(
    `Iniciando processamento da funcao study-metrics via metodo ${request.method} na URL ${request.url}`
  );

  try {
    if (request.method === 'GET') {
      const groupIdParam = request.query.get('groupId') || undefined;
      const customTotalTasks = request.query.get('totalTasks');
      const customCompletedTasks = request.query.get('completedTasks');
      const customMessages = request.query.get('messageCount');

      if (customTotalTasks !== null || customCompletedTasks !== null || customMessages !== null) {
        const total = Math.max(0, Number(customTotalTasks) || 0);
        const completed = Math.min(total, Math.max(0, Number(customCompletedTasks) || 0));
        const messagesTotal = Math.max(0, Number(customMessages) || 0);
        const targetGroupId = groupIdParam || 'grp-consulta-rapida';
        const groupName = request.query.get('groupName') || 'Grupo de Consulta Rapida';
        const hoursPerTask = Math.max(0.5, Number(request.query.get('hoursPerTask')) || 2);

        const syntheticTasks: StudyTaskInput[] = Array.from({ length: total }, (_, index) => ({
          id: `tsk-query-${index + 1}`,
          groupId: targetGroupId,
          title: `Atividade academica ${index + 1}`,
          completed: index < completed,
          estimatedHours: hoursPerTask
        }));

        const syntheticMessages: StudyMessageInput[] = Array.from(
          { length: messagesTotal },
          (_, index) => ({
            id: `msg-query-${index + 1}`,
            groupId: targetGroupId,
            senderName: `Estudante ${index + 1}`,
            content: `Mensagem de acompanhamento ${index + 1}`
          })
        );

        const result = calculateStudyMetrics({
          groups: [
            {
              id: targetGroupId,
              name: groupName,
              subject: request.query.get('subject') || 'Estudos Integrados',
              memberCount: Math.max(1, Number(request.query.get('memberCount')) || 3)
            }
          ],
          tasks: syntheticTasks,
          messages: syntheticMessages
        });

        context.log('Metricas calculadas com sucesso a partir dos parametros de consulta GET.');

        return {
          status: 200,
          jsonBody: {
            message: 'Relatorio analitico de produtividade gerado com sucesso via parametros de consulta.',
            data: result
          }
        };
      }

      const demoInput = buildDemoPortugueseDataset(groupIdParam);
      const result = calculateStudyMetrics(demoInput);

      context.log('Metricas demonstrativas dos grupos de estudo calculadas com sucesso via GET.');

      return {
        status: 200,
        jsonBody: {
          message: 'Relatorio demonstrativo de produtividade dos grupos de estudo gerado com sucesso.',
          data: result
        }
      };
    }

    if (request.method === 'POST') {
      let bodyPayload: MetricsCalculationInput;
      try {
        bodyPayload = (await request.json()) as MetricsCalculationInput;
      } catch {
        context.warn('Falha ao interpretar o corpo JSON enviado na requisicao POST.');
        return {
          status: 400,
          jsonBody: {
            error: 'Corpo da requisicao invalido. Envie um objeto JSON valido contendo groups, tasks e messages.'
          }
        };
      }

      if (!bodyPayload || typeof bodyPayload !== 'object' || Array.isArray(bodyPayload)) {
        return {
          status: 400,
          jsonBody: {
            error: 'Estrutura de dados invalida. O payload deve ser um objeto JSON com as listas groups, tasks ou messages.'
          }
        };
      }

      const hasValidArrays =
        Array.isArray(bodyPayload.groups) ||
        Array.isArray(bodyPayload.tasks) ||
        Array.isArray(bodyPayload.messages);

      if (!hasValidArrays) {
        return {
          status: 400,
          jsonBody: {
            error: 'Informe ao menos uma lista valida (groups, tasks ou messages) para realizar o calculo de produtividade.'
          }
        };
      }

      const result = calculateStudyMetrics(bodyPayload);
      context.log(
        `Calculo concluido via POST para ${result.groupBreakdown.length} grupo(s) de estudo.`
      );

      return {
        status: 200,
        jsonBody: {
          message: 'Calculo analitico de produtividade dos grupos de estudo realizado com sucesso.',
          data: result
        }
      };
    }

    return {
      status: 405,
      jsonBody: {
        error: `Metodo HTTP ${request.method} nao suportado. Utilize GET ou POST.`
      }
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro interno inesperado durante o processamento.';
    context.error(`Erro ao processar metricas dos grupos de estudo: ${errorMessage}`);

    return {
      status: 500,
      jsonBody: {
        error: 'Ocorreu um erro interno ao calcular as metricas de produtividade dos grupos de estudo.'
      }
    };
  }
}

app.http('studyMetrics', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'study-metrics',
  handler: studyMetricsHandler
});

