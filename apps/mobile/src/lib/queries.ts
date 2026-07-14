import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api';
import { setToken } from './authStore';

export type QuestionRoundType = 'Practice' | 'SpeedRace' | 'TrueFalse' | 'Riddle';

export type Question = {
  id: string;
  subject: string | null;
  roundType: 'General' | 'SpeedRace' | 'ProblemOfDay' | 'TrueFalse' | 'Riddle';
  questionText: string;
  correctAnswer: string;
  options: unknown[] | null;
  clues?: { order: number; clueText: string }[];
};

export type User = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  schoolId: string;
  xp: number;
  coinBalance: number;
  avatarUrl?: string;
};

export type AuthResult = { accessToken: string; user: User };

export type School = { id: string; name: string; region: string };

export type LeaderboardEntry = {
  rank: number;
  id: string;
  name: string;
  school: string;
  xp: number;
  avatarUrl: string | null;
};
export type LeaderboardResponse = { leaderboard: LeaderboardEntry[]; me: LeaderboardEntry };

export type AttemptPayload = {
  questionId: string;
  selectedOption?: string;
  selfReportedCorrect?: boolean;
};

export type AttemptResult = {
  id: string;
  questionId: string;
  selectedOption: string | null;
  selfReportedCorrect: boolean | null;
  xpEarned: number;
  attemptedAt: string;
  correct: boolean;
  xp: number;
};

export function useQuestions(roundType: QuestionRoundType, count = 10, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['questions', roundType, count],
    queryFn: () => apiRequest<Question[]>(`/questions/${roundType}?count=${count}`),
    enabled: options.enabled ?? true,
  });
}

export function useSubmitAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AttemptPayload) => apiRequest<AttemptResult>('/attempts', { method: 'POST', body: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useLeaderboard(limit = 20) {
  return useQuery({
    queryKey: ['leaderboard', limit],
    queryFn: () => apiRequest<LeaderboardResponse>(`/leaderboard?limit=${limit}`),
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => apiRequest<User>('/auth/me'),
  });
}

// Remaining questions the user may still answer today for each scored round type
// (SpeedRace/TrueFalse/Riddle are capped at 20/day; Practice/General/ProblemOfDay are unlimited
// and not included here).
export type RoundLimits = Record<'SpeedRace' | 'TrueFalse' | 'Riddle', number>;

export function useProfileLimits() {
  return useQuery({
    queryKey: ['profile', 'limits'],
    queryFn: () => apiRequest<RoundLimits>('/profile/limits'),
  });
}

export type ProfileStats = { quizzesCompleted: number; currentStreak: number };

export function useProfileStats() {
  return useQuery({
    queryKey: ['profile', 'stats'],
    queryFn: () => apiRequest<ProfileStats>('/profile/stats'),
  });
}

export type SubjectStat = { subject: string; accuracy: number; attempts: number };

export function useProfileSubjects() {
  return useQuery({
    queryKey: ['profile', 'subjects'],
    queryFn: () => apiRequest<SubjectStat[]>('/profile/subjects'),
  });
}

export type UpdateProfilePayload = { name?: string; schoolId?: string };

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => apiRequest<User>('/profile', { method: 'PATCH', body: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: { uri: string; name: string; type: string }) => {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as unknown as Blob);
      return apiRequest<User>('/profile/avatar', { method: 'POST', formData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useSchools() {
  return useQuery({
    queryKey: ['schools'],
    queryFn: () => apiRequest<School[]>('/schools'),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (payload: { name: string; schoolId: string; phone?: string; email?: string; password: string }) =>
      apiRequest<AuthResult>('/auth/register', { method: 'POST', body: payload }),
    onSuccess: async (result) => {
      await setToken(result.accessToken);
    },
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (payload: { identifier: string; password: string }) =>
      apiRequest<AuthResult>('/auth/login', { method: 'POST', body: payload }),
    onSuccess: async (result) => {
      await setToken(result.accessToken);
    },
  });
}
