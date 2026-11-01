# study-groups-fn-metrics

 Serviço Serverless em **Azure Functions v4 (Node.js 20 + TypeScript)** responsável pelo cálculo analítico de produtividade, engajamento e ritmo de estudos da plataforma **StudyGroups**.

---

## 1. Papel Serverless na Arquitetura

Na arquitetura distribuída do ecossistema **StudyGroups**, o microsserviço `study-groups-fn-metrics` atua como uma unidade computacional orientada a eventos sob demanda (*Function-as-a-Service* no **Azure Functions Consumption Plan**).

- **Desacoplamento Analítico:** Retira do backend principal a carga de processamento matemático de consolidação de horas de estudo, taxas de conclusão e índices de engajamento por grupo.
- **Escalabilidade Elástica e Custo Zero em Ociosidade:** Escala automaticamente em períodos de pico acadêmico (semanas de provas e entregas de projetos) sem manter servidores dedicados ociosos.
- **Execução Stateless:** Recebe snapshots de grupos, tarefas e mensagens via HTTP Trigger (`POST /api/study-metrics`) ou parâmetros de consulta rápida (`GET /api/study-metrics`) e devolve o diagnóstico analítico imediatamente.

---

## 2. Fórmulas de Produtividade e Regras de Negócio

O motor puro em `src/core/metricsCalculator.ts` processa os dados de entrada aplicando as seguintes métricas:

1. **Taxa de Conclusão (`completionRate` e `overallCompletionRate`):**
   $$\text{completionRate} = \left(\frac{\text{completedTasks}}{\text{totalTasks}}\right) \times 100$$
   Caso um grupo ainda não possua tarefas cadastradas (`totalTasks === 0`), a taxa é definida com segurança como `0%`.

2. **Horas Estimadas e Horas Concluídas (`estimatedHours` e `completedHours`):**
   Soma das horas atribuídas às tarefas. Quando uma tarefa não informa `estimatedHours` (ou informa valor inválido), aplica-se o padrão de `2h` por atividade acadêmica.

3. **Índice de Engajamento (`engagementScore` de `0` a `100`):**
   Combina o progresso nas entregas (`60%` do peso) com a participação ativa no chat do grupo (`40%` do peso):
   $$\text{expectedMessages} = \max(3, \text{memberCount} \times 2)$$
   $$\text{engagementScore} = (\text{completionRate} \times 0.60) + \left(\min\left(1, \frac{\text{messageCount}}{\text{expectedMessages}}\right) \times 40\right)$$

4. **Classificação do Ritmo de Estudos (`studyPaceStatus`):**
   Calculada a partir do índice ponderado $\text{weightedIndex} = (\text{completionRate} \times 0.65) + (\text{engagementScore} \times 0.35)$:
   - `EXCELLENT`: $\text{weightedIndex} \ge 75$ e $\text{completionRate} \ge 70$
   - `ON_TRACK`: $\text{weightedIndex} \ge 45$ e $\text{completionRate} \ge 40$
   - `NEEDS_ATTENTION`: Demais cenários que exigem reforço no cronograma ou na colaboração.

---

## 3. Endpoints e Exemplos de Payload

### 3.1. Healthcheck (`GET /api/health`)

Verifica a disponibilidade operacional da Function App.

**Resposta (`200 OK`):**
```json
{
  "status": "OPERATIONAL",
  "service": "study-groups-fn-metrics",
  "version": "1.0.0",
  "runtime": "node",
  "message": "Servico serverless de metricas dos Grupos de Estudo operacional e pronto para requisicoes.",
  "timestamp": "2026-11-01T18:00:00.000Z"
}
```

### 3.2. Cálculo Analítico via Lote (`POST /api/study-metrics`)

Recebe listas de grupos, tarefas e mensagens para processamento consolidado e individualizado por grupo.

**Exemplo de Requisição (`POST /api/study-metrics`):**
```json
{
  "groups": [
    {
      "id": "grp-arquitetura-nuvem",
      "name": "Grupo Arquitetura em Nuvem",
      "subject": "Computacao em Nuvem",
      "memberCount": 4,
      "targetHours": 12
    }
  ],
  "tasks": [
    {
      "id": "tsk-101",
      "groupId": "grp-arquitetura-nuvem",
      "title": "Implementar HTTP Trigger no Azure Functions v4",
      "completed": true,
      "estimatedHours": 4
    },
    {
      "id": "tsk-102",
      "groupId": "grp-arquitetura-nuvem",
      "title": "Configurar testes automatizados com Vitest",
      "completed": true,
      "estimatedHours": 3
    }
  ],
  "messages": [
    {
      "id": "msg-01",
      "groupId": "grp-arquitetura-nuvem",
      "senderName": "Ana Clara",
      "content": "Finalizei os testes da funcao de metricas!"
    }
  ]
}
```

### 3.3. Consulta Rápida ou Demonstrativa (`GET /api/study-metrics`)

- **Sem parâmetros:** Retorna o relatório demonstrativo completo em português.
- **Com filtro de grupo:** `GET /api/study-metrics?groupId=grp-arquitetura-nuvem`
- **Simulação rápida por query string:**
  `GET /api/study-metrics?groupName=Grupo%20Calculo&totalTasks=5&completedTasks=4&messageCount=6&memberCount=3`

---

## 4. Variáveis de Ambiente

Configure localmente no arquivo `local.settings.json` (baseado em `local.settings.json.example`) ou nas *Application Settings* da Function App no Portal Azure:

| Variável | Valor Padrão | Descrição |
| :--- | :--- | :--- |
| `FUNCTIONS_WORKER_RUNTIME` | `node` | Define o runtime de execução do Azure Functions Worker. |
| `DEFAULT_TARGET_HOURS_PER_GROUP` | `10` | Meta padrão de horas semanais por grupo quando não especificada no payload. |

---

## 5. Execução Local e Testes

### Pré-requisitos
- **Node.js 20 LTS** (`>=20.0.0`)
- **Azure Functions Core Tools v4** (`npm install -g azure-functions-core-tools@4 --unsafe-perm true`)

### Passo a Passo
```bash
npm install
cp local.settings.json.example local.settings.json
npm test
npm run build
npm start
```

---

## 6. Deploy no Azure Functions (Consumption Plan)

### Via Azure Functions Core Tools
```bash
npm run build
func azure functionapp publish <NOME_DA_SUA_FUNCTION_APP>
```

### Via Azure CLI
```bash
az group create --name rg-studygroups-serverless --location brazilsouth
az storage account create --name ststudygroupsmetrics --location brazilsouth --resource-group rg-studygroups-serverless --sku Standard_LRS
az functionapp create --resource-group rg-studygroups-serverless --consumption-plan-location brazilsouth --runtime node --runtime-version 20 --functions-version 4 --name fn-study-groups-metrics --storage-account ststudygroupsmetrics
```

---

## 7. Autores

- **Giuseppe Nunes**
- **João Gabriel Cintra**
- **Lara Bredow**
- **Viktor Trawinski**
