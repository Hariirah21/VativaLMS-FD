import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import {
  QuestionBankDraft,
  QuestionBankQuestion,
  QuestionBankQuestionType,
  QuestionBankRecord,
  QuestionBankSavedEvent,
  QuestionBankSection,
} from './question-bank.model';
import { QuestionBankStore } from './question-bank.store';

type QuestionTypeChoice = {
  value: QuestionBankQuestionType | 'mixed';
  label: string;
  disabled: boolean;
};

interface ExistingQuestionTemplate {
  id: string;
  type: QuestionBankQuestionType;
  prompt: string;
  shortAnswer: string;
  options: string[];
}

@Component({
  selector: 'app-question-bank',
  templateUrl: './question-bank.html',
  styleUrl: './question-bank.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionBank implements OnInit {
  private readonly store = inject(QuestionBankStore);
  private idSequence = 0;

  readonly courseId = input.required<number>();
  readonly courseSectionId = input.required<number>();
  readonly courseSectionName = input.required<string>();
  readonly questionBankId = input<number | null>(null);

  readonly saved = output<QuestionBankSavedEvent>();
  readonly closed = output<void>();

  readonly heading = computed(() =>
    this.questionBankId() === null ? 'Create Question Bank' : 'Edit Question Bank',
  );
  readonly questionTypes: readonly QuestionTypeChoice[] = [
    { value: 'single', label: 'Single Answer', disabled: false },
    { value: 'multiple', label: 'Multiple Answer', disabled: false },
    { value: 'short', label: 'Short Answer', disabled: false },
    { value: 'mixed', label: 'Mixed Answers', disabled: true },
  ];
  readonly selectedType = signal<QuestionBankQuestionType | null>(null);
  readonly sections = signal<QuestionBankSection[]>([]);
  readonly selectedSectionId = signal<string | null>(null);
  readonly importedFileNames = signal<string[]>([]);
  readonly editingSectionId = signal<string | null>(null);
  readonly editingSectionName = signal('');
  readonly pendingDeleteSectionId = signal<string | null>(null);
  readonly existingQuestionsOpen = signal(false);
  readonly saving = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');

  readonly selectedSection = computed(
    () =>
      this.sections().find(
        (section) => section.id === this.selectedSectionId(),
      ) ?? null,
  );
  readonly totalQuestions = computed(() =>
    this.sections().reduce(
      (total, section) => total + section.questions.length,
      0,
    ),
  );

  readonly existingQuestions: readonly ExistingQuestionTemplate[] = [
    {
      id: 'existing-1',
      type: 'single',
      prompt: 'Which option best describes the learning objective?',
      shortAnswer: '',
      options: [
        'Knowledge recall',
        'Practical application',
        'Unrelated activity',
        'No objective',
      ],
    },
    {
      id: 'existing-2',
      type: 'multiple',
      prompt: 'Select all valid assessment methods.',
      shortAnswer: '',
      options: ['Quiz', 'Project', 'Observation', 'Unscored decoration'],
    },
    {
      id: 'existing-3',
      type: 'short',
      prompt: 'Explain the objective in your own words.',
      shortAnswer: '',
      options: [],
    },
  ];

  ngOnInit(): void {
    const courseId = this.courseId();
    const courseSectionId = this.courseSectionId();
    const bankId = this.questionBankId();
    const record = bankId === null ? null : this.store.get(bankId);
    const draft = this.store.loadDraft(courseId, courseSectionId, bankId);
    const initial = draft ?? record ?? this.createEmptyDraft();

    this.selectedType.set(initial.questionType);
    this.sections.set(initial.sections);
    this.importedFileNames.set(initial.importedFileNames);
    this.selectedSectionId.set(initial.sections[0]?.id ?? null);
  }

  close(): void {
    this.closed.emit();
  }

  setQuestionType(type: QuestionBankQuestionType | 'mixed'): void {
    if (type === 'mixed') {
      this.showError('Mixed Answers is not available in this version.');
      return;
    }

    this.selectedType.set(type);
    this.persistDraft();
    this.clearMessages();
  }

  addSection(): void {
    const section: QuestionBankSection = {
      id: this.createId('section'),
      name: `Section ${this.sections().length + 1}`,
      questions: [],
      points: 0,
      feedback: '',
    };

    this.sections.update((sections) => [...sections, section]);
    this.selectedSectionId.set(section.id);
    this.persistDraft();
    this.clearMessages();
  }

  selectSection(sectionId: string): void {
    this.selectedSectionId.set(sectionId);
    this.pendingDeleteSectionId.set(null);
  }

  startRenameSection(section: QuestionBankSection): void {
    this.editingSectionId.set(section.id);
    this.editingSectionName.set(section.name);
    this.pendingDeleteSectionId.set(null);
  }

  setEditingSectionName(value: string): void {
    this.editingSectionName.set(value.slice(0, 80));
  }

  saveSectionName(sectionId: string): void {
    const name = this.editingSectionName().trim();
    if (!name) {
      this.showError('Section name cannot be empty.');
      return;
    }

    this.updateSection(sectionId, (section) => ({ ...section, name }));
    this.cancelRenameSection();
  }

  cancelRenameSection(): void {
    this.editingSectionId.set(null);
    this.editingSectionName.set('');
  }

  requestDeleteSection(sectionId: string): void {
    this.pendingDeleteSectionId.set(sectionId);
    this.cancelRenameSection();
  }

  cancelDeleteSection(): void {
    this.pendingDeleteSectionId.set(null);
  }

  deleteSection(sectionId: string): void {
    const remaining = this.sections().filter(
      (section) => section.id !== sectionId,
    );
    this.sections.set(remaining);

    if (this.selectedSectionId() === sectionId) {
      this.selectedSectionId.set(remaining[0]?.id ?? null);
    }

    this.pendingDeleteSectionId.set(null);
    this.persistDraft();
    this.successMessage.set('Section deleted.');
    this.errorMessage.set('');
  }

  duplicateSection(sectionId: string): void {
    const current = this.sections();
    const index = current.findIndex((section) => section.id === sectionId);
    if (index < 0) {
      return;
    }

    const source = current[index];
    const duplicate: QuestionBankSection = {
      ...source,
      id: this.createId('section'),
      name: `${source.name} Copy`,
      questions: source.questions.map((question) =>
        this.cloneQuestion(question),
      ),
    };
    const next = [...current];
    next.splice(index + 1, 0, duplicate);
    this.sections.set(next);
    this.selectedSectionId.set(duplicate.id);
    this.persistDraft();
  }

  moveSection(sectionId: string, direction: -1 | 1): void {
    const next = [...this.sections()];
    const index = next.findIndex((section) => section.id === sectionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= next.length) {
      return;
    }

    [next[index], next[target]] = [next[target], next[index]];
    this.sections.set(next);
    this.persistDraft();
  }

  addQuestion(): void {
    const section = this.selectedSection();
    const type = this.selectedType();

    if (!section) {
      this.showError('Add or select a section before adding a question.');
      return;
    }
    if (!type) {
      this.showError('Select a question type before adding a question.');
      return;
    }

    this.updateSection(section.id, (current) => ({
      ...current,
      questions: [...current.questions, this.createQuestion(type)],
    }));
    this.clearMessages();
  }

  duplicateQuestion(sectionId: string, questionId: string): void {
    const section = this.sections().find((item) => item.id === sectionId);
    const index =
      section?.questions.findIndex((question) => question.id === questionId) ??
      -1;
    if (!section || index < 0) {
      return;
    }

    const questions = [...section.questions];
    questions.splice(index + 1, 0, this.cloneQuestion(questions[index]));
    this.updateSection(sectionId, (current) => ({ ...current, questions }));
  }

  deleteQuestion(sectionId: string, questionId: string): void {
    this.updateSection(sectionId, (section) => ({
      ...section,
      questions: section.questions.filter(
        (question) => question.id !== questionId,
      ),
    }));
  }

  moveQuestion(
    sectionId: string,
    questionId: string,
    direction: -1 | 1,
  ): void {
    const section = this.sections().find((item) => item.id === sectionId);
    if (!section) {
      return;
    }

    const questions = [...section.questions];
    const index = questions.findIndex((question) => question.id === questionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= questions.length) {
      return;
    }

    [questions[index], questions[target]] = [
      questions[target],
      questions[index],
    ];
    this.updateSection(sectionId, (current) => ({ ...current, questions }));
  }

  updateQuestionPrompt(
    sectionId: string,
    questionId: string,
    value: string,
  ): void {
    this.updateQuestion(sectionId, questionId, (question) => ({
      ...question,
      prompt: value.slice(0, 500),
    }));
  }

  updateShortAnswer(
    sectionId: string,
    questionId: string,
    value: string,
  ): void {
    this.updateQuestion(sectionId, questionId, (question) => ({
      ...question,
      shortAnswer: value.slice(0, 500),
    }));
  }

  addOption(sectionId: string, questionId: string): void {
    this.updateQuestion(sectionId, questionId, (question) => ({
      ...question,
      options: [...question.options, this.createOption()],
    }));
  }

  updateOption(
    sectionId: string,
    questionId: string,
    optionId: string,
    value: string,
  ): void {
    this.updateQuestion(sectionId, questionId, (question) => ({
      ...question,
      options: question.options.map((option) =>
        option.id === optionId ? { ...option, text: value.slice(0, 200) } : option,
      ),
    }));
  }

  toggleCorrect(
    sectionId: string,
    questionId: string,
    optionId: string,
  ): void {
    this.updateQuestion(sectionId, questionId, (question) => ({
      ...question,
      options: question.options.map((option) => ({
        ...option,
        correct:
          question.type === 'single'
            ? option.id === optionId
            : option.id === optionId
              ? !option.correct
              : option.correct,
      })),
    }));
  }

  removeOption(
    sectionId: string,
    questionId: string,
    optionId: string,
  ): void {
    const question = this.sections()
      .find((section) => section.id === sectionId)
      ?.questions.find((item) => item.id === questionId);
    if (!question) {
      return;
    }
    if (question.options.length <= 2) {
      this.showError('A choice question must keep at least two options.');
      return;
    }

    this.updateQuestion(sectionId, questionId, (current) => ({
      ...current,
      options: current.options.filter((option) => option.id !== optionId),
    }));
  }

  updatePoints(sectionId: string, value: number): void {
    const points = Number.isFinite(value)
      ? Math.min(100, Math.max(0, value))
      : 0;
    this.updateSection(sectionId, (section) => ({ ...section, points }));
  }

  updateFeedback(sectionId: string, value: string): void {
    this.updateSection(sectionId, (section) => ({
      ...section,
      feedback: value.slice(0, 500),
    }));
  }

  importQuestions(event: Event): void {
    const inputElement = event.target;
    if (!(inputElement instanceof HTMLInputElement)) {
      return;
    }

    const files = Array.from(inputElement.files ?? []);
    inputElement.value = '';
    if (files.length === 0) {
      return;
    }

    const acceptedExtensions = [
      '.pdf',
      '.doc',
      '.docx',
      '.csv',
      '.xls',
      '.xlsx',
    ];
    const invalidFile = files.find((file) => {
      const name = file.name.toLowerCase();
      return !acceptedExtensions.some((extension) => name.endsWith(extension));
    });
    if (invalidFile) {
      this.showError(
        `${invalidFile.name} has an invalid type. Use PDF, DOC, DOCX, CSV, XLS, or XLSX.`,
      );
      return;
    }

    const oversizedFile = files.find((file) => file.size > 100 * 1024 * 1024);
    if (oversizedFile) {
      this.showError(`${oversizedFile.name} exceeds the maximum file size of 100 MB.`);
      return;
    }

    this.importedFileNames.update((names) =>
      Array.from(new Set([...names, ...files.map((file) => file.name)])),
    );
    this.persistDraft();
    this.successMessage.set(`${files.length} import file(s) accepted for processing.`);
    this.errorMessage.set('');
  }

  removeImportedFile(fileName: string): void {
    this.importedFileNames.update((names) =>
      names.filter((name) => name !== fileName),
    );
    this.persistDraft();
  }

  exportQuestions(): void {
    if (this.totalQuestions() === 0) {
      this.showError('Add at least one question before exporting.');
      return;
    }

    const file = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            questionBank: this.createDraft(),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `question-bank-${this.questionBankId() ?? 'new'}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    this.successMessage.set('Question Bank exported successfully.');
    this.errorMessage.set('');
  }

  openExistingQuestions(): void {
    if (!this.selectedSection()) {
      this.showError(
        'Add or select a section before choosing an existing question.',
      );
      return;
    }
    this.existingQuestionsOpen.set(true);
    this.clearMessages();
  }

  closeExistingQuestions(): void {
    this.existingQuestionsOpen.set(false);
  }

  addExistingQuestion(template: ExistingQuestionTemplate): void {
    const section = this.selectedSection();
    if (!section) {
      this.closeExistingQuestions();
      this.showError('Select a section before adding an existing question.');
      return;
    }

    const question: QuestionBankQuestion = {
      id: this.createId('question'),
      type: template.type,
      prompt: template.prompt,
      shortAnswer: template.shortAnswer,
      options: template.options.map((text) => ({
        ...this.createOption(),
        text,
      })),
    };
    this.updateSection(section.id, (current) => ({
      ...current,
      questions: [...current.questions, question],
    }));
    this.closeExistingQuestions();
  }

  async saveQuestionBank(): Promise<void> {
    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.clearMessages();
    await Promise.resolve();

    try {
      const created = this.questionBankId() === null;
      const record = this.store.save(this.createDraft());
      this.store.clearDraft(
        this.courseId(),
        this.courseSectionId(),
        this.questionBankId(),
      );
      this.successMessage.set('Question Bank saved successfully.');
      this.saved.emit({ record, created });
    } catch (error: unknown) {
      this.showError(
        error instanceof Error
          ? error.message
          : 'Unable to save the Question Bank. Please try again.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  textValue(event: Event): string {
    const target = event.target;
    return target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
      ? target.value
      : '';
  }

  numberValue(event: Event): number {
    const value = this.textValue(event);
    return Number(value);
  }

  typeLabel(type: QuestionBankQuestionType): string {
    switch (type) {
      case 'single':
        return 'Single Answer';
      case 'multiple':
        return 'Multiple Answer';
      case 'short':
        return 'Short Answer';
    }
  }

  private createQuestion(type: QuestionBankQuestionType): QuestionBankQuestion {
    return {
      id: this.createId('question'),
      type,
      prompt: '',
      shortAnswer: '',
      options:
        type === 'short'
          ? []
          : Array.from({ length: 4 }, () => this.createOption()),
    };
  }

  private createOption(): QuestionBankQuestion['options'][number] {
    return { id: this.createId('option'), text: '', correct: false };
  }

  private cloneQuestion(question: QuestionBankQuestion): QuestionBankQuestion {
    return {
      ...question,
      id: this.createId('question'),
      options: question.options.map((option) => ({
        ...option,
        id: this.createId('option'),
      })),
    };
  }

  private updateQuestion(
    sectionId: string,
    questionId: string,
    update: (question: QuestionBankQuestion) => QuestionBankQuestion,
  ): void {
    this.updateSection(sectionId, (section) => ({
      ...section,
      questions: section.questions.map((question) =>
        question.id === questionId ? update(question) : question,
      ),
    }));
  }

  private updateSection(
    sectionId: string,
    update: (section: QuestionBankSection) => QuestionBankSection,
  ): void {
    this.sections.update((sections) =>
      sections.map((section) =>
        section.id === sectionId ? update(section) : section,
      ),
    );
    this.persistDraft();
  }

  private createDraft(): QuestionBankDraft {
    return {
      id: this.questionBankId(),
      name: '',
      courseId: this.courseId(),
      courseSectionId: this.courseSectionId(),
      questionType: this.selectedType(),
      sections: this.sections(),
      importedFileNames: this.importedFileNames(),
    };
  }

  private createEmptyDraft(): QuestionBankDraft {
    return {
      id: this.questionBankId(),
      name: '',
      courseId: this.courseId(),
      courseSectionId: this.courseSectionId(),
      questionType: null,
      sections: [],
      importedFileNames: [],
    };
  }

  private persistDraft(): void {
    try {
      this.store.saveDraft(this.createDraft());
    } catch (error: unknown) {
      this.showError(
        error instanceof Error
          ? error.message
          : 'Unable to save the Question Bank draft.',
      );
    }
  }

  private clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    this.successMessage.set('');
  }

  private createId(prefix: string): string {
    this.idSequence += 1;
    return `${prefix}-${Date.now().toString(36)}-${this.idSequence.toString(36)}`;
  }
}
