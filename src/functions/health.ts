import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function healthCheckHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Verificacao de integridade acionada via ${request.method} em ${request.url}`);

  return {
    status: 200,
    jsonBody: {
      status: 'OPERATIONAL',
      service: 'study-groups-fn-metrics',
      version: '1.0.0',
      runtime: process.env.FUNCTIONS_WORKER_RUNTIME || 'node',
      message: 'Servico serverless de metricas dos Grupos de Estudo operacional e pronto para requisicoes.',
      timestamp: new Date().toISOString()
    }
  };
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: healthCheckHandler
});
