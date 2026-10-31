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
  groups?: StudyGroupInput[];
  tasks?: StudyTaskInput[];
  messages?: StudyMessageInput[];
  defaultTargetHoursPerGroup?: number;
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
  return Math.round(value * 100) / 100;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, roundToTwoDecimals(value)));
}

export function resolvePaceStatus(
  completionRate: number,
  engagementScore: number
): { status: StudyPaceStatus; label: string } {
  const weightedIndex = completionRate * 0.65 + engagementScore * 0.35;

  if (weightedIndex >= 75 && completionRate >= 70) {
    return {
      status: 'EXCELLENT',
      label: 'Ritmo excelente de estudos e alta colaboracao entre os membros'
    };
  }

  if (weightedIndex >= 45 && completionRate >= 40) {
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
  targetHours: number
): string {
  if (completionRate >= 80 && messageCount >= 3 && completedHours >= targetHours * 0.7) {
    return `O grupo "${groupName}" apresenta excelente desempenho! Mantenham os encontros sincronos e avancem para simulados praticos.`;
  }

  if (completionRate < 40 && messageCount < 2) {
    return `Atencao prioritaria para "${groupName}": poucas tarefas concluidas e baixa interacao no chat. Organizem uma sessao de alinhamento urgente.`;
  }

  if (completionRate < 50) {
    return `O grupo "${groupName}" possui boa comunicacao, mas precisa concluir as tarefas pendentes para atingir a meta de ${targetHours}h.`;
  }

  if (messageCount < 2) {
    return `O grupo "${groupName}" esta entregando atividades no prazo, porem pode melhorar o compartilhamento de duvidas e resumos no chat.`;
  }

  return `O grupo "${groupName}" segue em bom ritmo (${completionRate}% concluido). Continuem revisando os topicos principais semanalmente.`;
}

export function calculateStudyMetrics(input: MetricsCalculationInput): StudyMetricsResult {
  const defaultTargetHours =
    input.defaultTargetHoursPerGroup && input.defaultTargetHoursPerGroup > 0
      ? input.defaultTargetHoursPerGroup
      : Number(process.env.DEFAULT_TARGET_HOURS_PER_GROUP) || 10;

  const rawGroups = Array.isArray(input.groups) ? input.groups : [];
  const rawTasks = Array.isArray(input.tasks) ? input.tasks : [];
  const rawMessages = Array.isArray(input.messages) ? input.messages : [];

  const discoveredGroupIds = new Set<string>();
  for (const group of rawGroups) {
    if (group && typeof group.id === 'string' && group.id.trim() !== '') {
      discoveredGroupIds.add(group.id.trim());
    }
  }
  for (const task of rawTasks) {
    if (task && typeof task.groupId === 'string' && task.groupId.trim() !== '') {
      discoveredGroupIds.add(task.groupId.trim());
    }
  }
  for (const message of rawMessages) {
    if (message && typeof message.groupId === 'string' && message.groupId.trim() !== '') {
      discoveredGroupIds.add(message.groupId.trim());
    }
  }

  const normalizedGroups: StudyGroupInput[] = Array.from(discoveredGroupIds).map((groupId) => {
    const found = rawGroups.find((item) => item.id === groupId);
    return {
      id: groupId,
      name: found?.name?.trim() || `Grupo ${groupId}`,
      subject: found?.subject?.trim() || 'Disciplina Geral',
      memberCount: found?.memberCount && found.memberCount > 0 ? found.memberCount : 1,
      targetHours:
        found?.targetHours && found.targetHours > 0 ? found.targetHours : defaultTargetHours
    };
  });

  const groupBreakdown: GroupMetricsBreakdown[] = normalizedGroups.map((group) => {
    const groupTasks = rawTasks.filter((task) => task.groupId === group.id);
    const groupMessages = rawMessages.filter((message) => message.groupId === group.id);

    const totalTasks = groupTasks.length;
    const completedTasks = groupTasks.filter((task) => Boolean(task.completed)).length;
    const completionRate =
      totalTasks > 0 ? roundToTwoDecimals((completedTasks / totalTasks) * 100) : 0;

    const estimatedHours = roundToTwoDecimals(
      groupTasks.reduce((sum, task) => {
        const hours =
          typeof task.estimatedHours === 'number' && task.estimatedHours > 0
            ? task.estimatedHours
            : 2;
        return sum + hours;
      }, 0)
    );

    const completedHours = roundToTwoDecimals(
      groupTasks
        .filter((task) => Boolean(task.completed))
        .reduce((sum, task) => {
          const hours =
            typeof task.estimatedHours === 'number' && task.estimatedHours > 0
              ? task.estimatedHours
              : 2;
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
      targetHours
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
      : groupBreakdown.length > 0
        ? roundToTwoDecimals(
            groupBreakdown.reduce((acc, item) => acc + item.completionRate, 0) /
              groupBreakdown.length
          )
        : 0;

  const totalEstimatedHours = roundToTwoDecimals(
    rawTasks.reduce((sum, task) => {
      const hours =
        typeof task.estimatedHours === 'number' && task.estimatedHours > 0
          ? task.estimatedHours
          : 2;
      return sum + hours;
    }, 0)
  );

  const completedHours = roundToTwoDecimals(
    rawTasks
      .filter((task) => Boolean(task.completed))
      .reduce((sum, task) => {
        const hours =
          typeof task.estimatedHours === 'number' && task.estimatedHours > 0
            ? task.estimatedHours
            : 2;
        return sum + hours;
      }, 0)
  );

  let engagementScore = 0;
  if (groupBreakdown.length > 0) {
    const sumEngagement = groupBreakdown.reduce((acc, item) => acc + item.engagementScore, 0);
    engagementScore = clampScore(sumEngagement / groupBreakdown.length);
  } else if (totalTasksAll > 0 || rawMessages.length > 0) {
    const deliveryComponent = overallCompletionRate * 0.6;
    const messageComponent = Math.min(1, rawMessages.length / 5) * 40;
    engagementScore = clampScore(deliveryComponent + messageComponent);
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

