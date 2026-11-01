export type StudyPaceStatus = 'EXCELLENT' | 'ON_TRACK' | 'NEEDS_ATTENTION';

export interface StudyGroupInput {
  id: string;
  name: string;
  subject?: string;
  memberCount?: number;
  targetHours?: number;
}

export interface StudyTaskInput {
  id: string;
  groupId: string;
  title: string;
  completed: boolean;
  estimatedHours?: number;
}

export interface StudyMessageInput {
  id: string;
  groupId: string;
  senderName?: string;
  content?: string;
}

export interface MetricsCalculationInput {
  groups?: StudyGroupInput[] | null;
  tasks?: StudyTaskInput[] | null;
  messages?: StudyMessageInput[] | null;
  defaultTargetHoursPerGroup?: number | null;
}

export interface GroupMetricsBreakdown {
  groupId: string;
  groupName: string;
  subject: string;
  memberCount: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  estimatedHours: number;
  completedHours: number;
  targetHours: number;
  messageCount: number;
  engagementScore: number;
  studyPaceStatus: StudyPaceStatus;
  paceLabel: string;
  recommendation: string;
}

export interface StudyMetricsResult {
  overallCompletionRate: number;
  totalEstimatedHours: number;
  completedHours: number;
  engagementScore: number;
  studyPaceStatus: StudyPaceStatus;
  paceLabel: string;
  groupBreakdown: GroupMetricsBreakdown[];
  calculatedAt: string;
}

function roundToTwoDecimals(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, roundToTwoDecimals(value)));
}

function sanitizePositiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

export function resolvePaceStatus(
  completionRate: number,
  engagementScore: number
): { status: StudyPaceStatus; label: string } {
  const safeCompletion = clampScore(completionRate);
  const safeEngagement = clampScore(engagementScore);
  const weightedIndex = safeCompletion * 0.65 + safeEngagement * 0.35;

  if (weightedIndex >= 75 && safeCompletion >= 70) {
    return {
      status: 'EXCELLENT',
      label: 'Ritmo excelente de estudos e alta colaboracao entre os membros'
    };
  }

  if (weightedIndex >= 45 && safeCompletion >= 40) {
    return {
      status: 'ON_TRACK',
      label: 'Ritmo adequado e evolucao constante nas metas da disciplina'
    };
  }

  return {
    status: 'NEEDS_ATTENTION',
    label: 'Ritmo abaixo do esperado; recomenda-se reforcar o cronograma e a participacao'
  };
}

export function buildGroupRecommendation(
  groupName: string,
  completionRate: number,
  messageCount: number,
  completedHours: number,
  targetHours: number,
  totalTasks = 1
): string {
  const safeGroupName = groupName?.trim() || 'Grupo de Estudo';

  if (totalTasks === 0) {
    return `O grupo "${safeGroupName}" ainda nao possui tarefas cadastradas. Cadastrem as metas da semana para iniciar o acompanhamento.`;
  }

  if (completionRate >= 80 && messageCount >= 3 && completedHours >= targetHours * 0.7) {
    return `O grupo "${safeGroupName}" apresenta excelente desempenho! Mantenham os encontros sincronos e avancem para simulados praticos.`;
  }

  if (completionRate < 40 && messageCount < 2) {
    return `Atencao prioritaria para "${safeGroupName}": poucas tarefas concluidas e baixa interacao no chat. Organizem uma sessao de alinhamento urgente.`;
  }

  if (completionRate < 50) {
    return `O grupo "${safeGroupName}" possui boa comunicacao, mas precisa concluir as tarefas pendentes para atingir a meta de ${targetHours}h.`;
  }

  if (messageCount < 2) {
    return `O grupo "${safeGroupName}" esta entregando atividades no prazo, porem pode melhorar o compartilhamento de duvidas e resumos no chat.`;
  }

  return `O grupo "${safeGroupName}" segue em bom ritmo (${completionRate}% concluido). Continuem revisando os topicos principais semanalmente.`;
}

export function calculateStudyMetrics(
  input?: MetricsCalculationInput | null
): StudyMetricsResult {
  const safeInput: MetricsCalculationInput =
    input && typeof input === 'object' ? input : {};

  const envTargetHours = sanitizePositiveNumber(
    process.env.DEFAULT_TARGET_HOURS_PER_GROUP,
    10
  );
  const defaultTargetHours = sanitizePositiveNumber(
    safeInput.defaultTargetHoursPerGroup,
    envTargetHours
  );

  const rawGroups = Array.isArray(safeInput.groups)
    ? safeInput.groups.filter(
        (group): group is StudyGroupInput =>
          Boolean(group && typeof group === 'object' && typeof group.id === 'string' && group.id.trim() !== '')
      )
    : [];

  const rawTasks = Array.isArray(safeInput.tasks)
    ? safeInput.tasks.filter(
        (task): task is StudyTaskInput =>
          Boolean(task && typeof task === 'object' && typeof task.groupId === 'string' && task.groupId.trim() !== '')
      )
    : [];

  const rawMessages = Array.isArray(safeInput.messages)
    ? safeInput.messages.filter(
        (message): message is StudyMessageInput =>
          Boolean(
            message &&
              typeof message === 'object' &&
              typeof message.groupId === 'string' &&
              message.groupId.trim() !== ''
          )
      )
    : [];

  const discoveredGroupIds = new Set<string>();
  for (const group of rawGroups) {
    discoveredGroupIds.add(group.id.trim());
  }
  for (const task of rawTasks) {
    discoveredGroupIds.add(task.groupId.trim());
  }
  for (const message of rawMessages) {
    discoveredGroupIds.add(message.groupId.trim());
  }

  const normalizedGroups: StudyGroupInput[] = Array.from(discoveredGroupIds).map((groupId) => {
    const found = rawGroups.find((item) => item.id.trim() === groupId);
    return {
      id: groupId,
      name: found?.name?.trim() || `Grupo ${groupId}`,
      subject: found?.subject?.trim() || 'Disciplina Geral',
      memberCount: Math.floor(sanitizePositiveNumber(found?.memberCount, 1)),
      targetHours: sanitizePositiveNumber(found?.targetHours, defaultTargetHours)
    };
  });

  const groupBreakdown: GroupMetricsBreakdown[] = normalizedGroups.map((group) => {
    const groupTasks = rawTasks.filter((task) => task.groupId.trim() === group.id);
    const groupMessages = rawMessages.filter((message) => message.groupId.trim() === group.id);

    const totalTasks = groupTasks.length;
    const completedTasks = groupTasks.filter((task) => Boolean(task.completed)).length;
    const completionRate =
      totalTasks > 0 ? roundToTwoDecimals((completedTasks / totalTasks) * 100) : 0;

    const estimatedHours = roundToTwoDecimals(
      groupTasks.reduce((sum, task) => {
        const hours = sanitizePositiveNumber(task.estimatedHours, 2);
        return sum + hours;
      }, 0)
    );

    const completedHours = roundToTwoDecimals(
      groupTasks
        .filter((task) => Boolean(task.completed))
        .reduce((sum, task) => {
          const hours = sanitizePositiveNumber(task.estimatedHours, 2);
          return sum + hours;
        }, 0)
    );

    const messageCount = groupMessages.length;
    const memberCount = group.memberCount || 1;
    const targetHours = group.targetHours || defaultTargetHours;

    const deliveryComponent = completionRate * 0.6;
    const expectedMessages = Math.max(3, memberCount * 2);
    const interactionRatio = Math.min(1, messageCount / expectedMessages);
    const messageComponent = interactionRatio * 40;
    const groupEngagementScore = clampScore(deliveryComponent + messageComponent);

    const paceInfo = resolvePaceStatus(completionRate, groupEngagementScore);
    const recommendation = buildGroupRecommendation(
      group.name,
      completionRate,
      messageCount,
      completedHours,
      targetHours,
      totalTasks
    );

    return {
      groupId: group.id,
      groupName: group.name,
      subject: group.subject || 'Disciplina Geral',
      memberCount,
      totalTasks,
      completedTasks,
      completionRate,
      estimatedHours,
      completedHours,
      targetHours,
      messageCount,
      engagementScore: groupEngagementScore,
      studyPaceStatus: paceInfo.status,
      paceLabel: paceInfo.label,
      recommendation
    };
  });

  const totalTasksAll = rawTasks.length;
  const completedTasksAll = rawTasks.filter((task) => Boolean(task.completed)).length;

  const overallCompletionRate =
    totalTasksAll > 0
      ? roundToTwoDecimals((completedTasksAll / totalTasksAll) * 100)
      : 0;

  const totalEstimatedHours = roundToTwoDecimals(
    rawTasks.reduce((sum, task) => {
      const hours = sanitizePositiveNumber(task.estimatedHours, 2);
      return sum + hours;
    }, 0)
  );

  const completedHours = roundToTwoDecimals(
    rawTasks
      .filter((task) => Boolean(task.completed))
      .reduce((sum, task) => {
        const hours = sanitizePositiveNumber(task.estimatedHours, 2);
        return sum + hours;
      }, 0)
  );

  let engagementScore = 0;
  if (groupBreakdown.length > 0) {
    const sumEngagement = groupBreakdown.reduce((acc, item) => acc + item.engagementScore, 0);
    engagementScore = clampScore(sumEngagement / groupBreakdown.length);
  }

  const overallPace = resolvePaceStatus(overallCompletionRate, engagementScore);

  return {
    overallCompletionRate,
    totalEstimatedHours,
    completedHours,
    engagementScore,
    studyPaceStatus: overallPace.status,
    paceLabel: overallPace.label,
    groupBreakdown,
    calculatedAt: new Date().toISOString()
  };
}
