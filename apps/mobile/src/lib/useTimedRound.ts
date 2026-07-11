import { useEffect, useState } from 'react';

export type RoundPhase = 'active' | 'answered' | 'complete';

type UseTimedRoundArgs<Question, Answer> = {
  questions: Question[];
  roundSeconds: number;
  xpPerCorrect: number;
  isCorrect: (question: Question, answer: Answer) => boolean;
};

// Shared quiz-round engine: countdown timer, answer/timeout feedback, and XP tally.
// Speed Race (multiple choice) and True or False (boolean) both drive this with their own
// question/answer shapes via `isCorrect`. Advancing to the next question is manual - the
// screen calls `advance()` once the user taps Continue, rather than this hook doing it
// automatically after a delay.
export function useTimedRound<Question, Answer>({
  questions,
  roundSeconds,
  xpPerCorrect,
  isCorrect,
}: UseTimedRoundArgs<Question, Answer>) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(roundSeconds);
  const [selectedAnswer, setSelectedAnswer] = useState<Answer | null>(null);
  const [phase, setPhase] = useState<RoundPhase>('active');
  const [totalXP, setTotalXP] = useState(0);

  const question = questions[currentIndex];

  // Countdown ticks once per second while a question is active; hitting 0 counts as a
  // no-answer and reveals the correct option same as a wrong tap would. The timer stops
  // here - it does not resume until the user advances to the next question.
  useEffect(() => {
    if (phase !== 'active') return;
    if (secondsLeft <= 0) {
      setPhase('answered');
      setSelectedAnswer(null);
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, secondsLeft]);

  function submitAnswer(answer: Answer) {
    if (phase !== 'active') return;
    setSelectedAnswer(answer);
    setPhase('answered');
    if (isCorrect(question, answer)) {
      setTotalXP((xp) => xp + xpPerCorrect);
    }
  }

  // Called when the user taps Continue on the feedback screen - moves to the next
  // question (resetting its timer) or finishes the round.
  function advance() {
    if (phase !== 'answered') return;
    const next = currentIndex + 1;
    if (next >= questions.length) {
      setPhase('complete');
      return;
    }
    setCurrentIndex(next);
    setSecondsLeft(roundSeconds);
    setSelectedAnswer(null);
    setPhase('active');
  }

  const answered = phase === 'answered';
  const earnedThisQuestion = selectedAnswer !== null && isCorrect(question, selectedAnswer) ? xpPerCorrect : 0;

  return {
    question,
    currentIndex,
    secondsLeft,
    roundSeconds,
    phase,
    selectedAnswer,
    totalXP,
    answered,
    earnedThisQuestion,
    submitAnswer,
    advance,
  };
}
