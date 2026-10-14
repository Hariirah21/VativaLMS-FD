import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionBankSavedEvent } from './question-bank.model';
import { QuestionBank } from './question-bank';

describe('QuestionBank', () => {
  let component: QuestionBank;
  let fixture: ComponentFixture<QuestionBank>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [QuestionBank] }).compileComponents();

    fixture = TestBed.createComponent(QuestionBank);
    fixture.componentRef.setInput('courseId', 10);
    fixture.componentRef.setInput('courseSectionId', 20);
    fixture.componentRef.setInput('courseSectionName', 'Section 1');
    fixture.componentRef.setInput('questionBankId', null);
    fixture.detectChanges();
    await fixture.whenStable();
    component = fixture.componentInstance;
  });

  it('creates with the required empty defaults', () => {
    expect(component).toBeTruthy();
    expect(component.selectedType()).toBeNull();
    expect(component.sections()).toEqual([]);
    expect(component.totalQuestions()).toBe(0);
  });

  it('adds a section with zero points and empty feedback', () => {
    component.addSection();

    expect(component.sections()).toHaveLength(1);
    expect(component.sections()[0].name).toBe('Section 1');
    expect(component.sections()[0].points).toBe(0);
    expect(component.sections()[0].feedback).toBe('');
  });

  it('adds a single-answer question with four empty options', () => {
    component.addSection();
    component.setQuestionType('single');
    component.addQuestion();

    const question = component.sections()[0].questions[0];
    expect(question.type).toBe('single');
    expect(question.prompt).toBe('');
    expect(question.options).toHaveLength(4);
    expect(question.options.every((option) => option.text === '')).toBe(true);
  });

  it('keeps only one correct option for a single-answer question', () => {
    component.addSection();
    component.setQuestionType('single');
    component.addQuestion();

    const section = component.sections()[0];
    const question = section.questions[0];
    component.toggleCorrect(section.id, question.id, question.options[0].id);
    component.toggleCorrect(section.id, question.id, question.options[1].id);

    const options = component.sections()[0].questions[0].options;
    expect(options.filter((option) => option.correct)).toHaveLength(1);
    expect(options[1].correct).toBe(true);
  });

  it('supports multiple correct options for a multiple-answer question', () => {
    component.addSection();
    component.setQuestionType('multiple');
    component.addQuestion();

    const section = component.sections()[0];
    const question = section.questions[0];
    component.toggleCorrect(section.id, question.id, question.options[0].id);
    component.toggleCorrect(section.id, question.id, question.options[1].id);

    expect(
      component.sections()[0].questions[0].options.filter((option) => option.correct),
    ).toHaveLength(2);
  });

  it('clamps score values to the supported range', () => {
    component.addSection();
    const sectionId = component.sections()[0].id;

    component.updatePoints(sectionId, 150);
    expect(component.sections()[0].points).toBe(100);

    component.updatePoints(sectionId, -10);
    expect(component.sections()[0].points).toBe(0);
  });

  it('ignores repeated save clicks and emits one saved record', async () => {
    const events: QuestionBankSavedEvent[] = [];
    component.saved.subscribe((event) => events.push(event));
    component.addSection();
    component.setQuestionType('short');
    component.addQuestion();

    const firstSave = component.saveQuestionBank();
    const repeatedSave = component.saveQuestionBank();
    await Promise.all([firstSave, repeatedSave]);

    expect(events).toHaveLength(1);
    expect(events[0].created).toBe(true);
    expect(component.successMessage()).toBe('Question Bank saved successfully.');
  });
});
