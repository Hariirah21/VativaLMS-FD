export type QuestionBankQuestionType = 'single' | 'multiple' | 'short';

export interface QuestionBankOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface QuestionBankQuestion {
  id: string;
  type: QuestionBankQuestionType;
  prompt: string;
  shortAnswer: string;
  options: QuestionBankOption[];
}

export interface QuestionBankSection {
  id: string;
  name: string;
  questions: QuestionBankQuestion[];
  points: number;
  feedback: string;
}

export interface QuestionBankDraft {
  id: number | null;
  name: string;
  courseId: number;
  courseSectionId: number;
  questionType: QuestionBankQuestionType | null;
  sections: QuestionBankSection[];
  importedFileNames: string[];
}

export interface QuestionBankRecord extends Omit<QuestionBankDraft, 'id'> {
  id: number;
  updatedAt: string;
}

export interface QuestionBankSavedEvent {
  record: QuestionBankRecord;
  created: boolean;
}
