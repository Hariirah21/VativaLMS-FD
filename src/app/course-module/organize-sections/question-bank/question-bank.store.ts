import { Injectable } from '@angular/core';

import { QuestionBankDraft, QuestionBankRecord } from './question-bank.model';

@Injectable({ providedIn: 'root' })
export class QuestionBankStore {
  private readonly banksStorageKey = 'vativa-lms-question-banks-v1';
  private readonly draftStorageKey = 'vativa-lms-question-bank-drafts-v1';

  listForSection(courseId: number, courseSectionId: number): QuestionBankRecord[] {
    return this.readBanks().filter(
      (bank) => bank.courseId === courseId && bank.courseSectionId === courseSectionId,
    );
  }

  get(bankId: number): QuestionBankRecord | null {
    return this.readBanks().find((bank) => bank.id === bankId) ?? null;
  }

  save(draft: QuestionBankDraft): QuestionBankRecord {
    const banks = this.readBanks();
    const existingIndex = draft.id === null ? -1 : banks.findIndex((bank) => bank.id === draft.id);
    const id = existingIndex >= 0 ? banks[existingIndex].id : this.nextId(banks);
    const record: QuestionBankRecord = {
      ...draft,
      id,
      name: draft.name.trim() || this.nextName(draft.courseId, draft.courseSectionId),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      banks[existingIndex] = record;
    } else {
      banks.push(record);
    }

    this.writeJson(this.banksStorageKey, banks);
    return record;
  }

  remove(bankId: number): void {
    this.writeJson(
      this.banksStorageKey,
      this.readBanks().filter((bank) => bank.id !== bankId),
    );
  }

  loadDraft(
    courseId: number,
    courseSectionId: number,
    bankId: number | null,
  ): QuestionBankDraft | null {
    const drafts = this.readDrafts();
    return drafts[this.contextKey(courseId, courseSectionId, bankId)] ?? null;
  }

  saveDraft(draft: QuestionBankDraft): void {
    const drafts = this.readDrafts();
    drafts[this.contextKey(draft.courseId, draft.courseSectionId, draft.id)] = draft;
    this.writeJson(this.draftStorageKey, drafts);
  }

  clearDraft(courseId: number, courseSectionId: number, bankId: number | null): void {
    const drafts = this.readDrafts();
    delete drafts[this.contextKey(courseId, courseSectionId, bankId)];
    this.writeJson(this.draftStorageKey, drafts);
  }

  private readBanks(): QuestionBankRecord[] {
    const value = this.readJson<unknown>(this.banksStorageKey, []);
    return Array.isArray(value) ? (value as QuestionBankRecord[]) : [];
  }

  private readDrafts(): Record<string, QuestionBankDraft> {
    const value = this.readJson<unknown>(this.draftStorageKey, {});
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, QuestionBankDraft>)
      : {};
  }

  private readJson<T>(key: string, fallback: T): T {
    if (typeof localStorage === 'undefined') return fallback;

    try {
      const stored = localStorage.getItem(key);
      return stored === null ? fallback : (JSON.parse(stored) as T);
    } catch {
      return fallback;
    }
  }

  private writeJson(key: string, value: unknown): void {
    if (typeof localStorage === 'undefined') {
      throw new Error('Browser storage is unavailable.');
    }
    localStorage.setItem(key, JSON.stringify(value));
  }

  private nextId(banks: QuestionBankRecord[]): number {
    return banks.reduce((highest, bank) => Math.max(highest, bank.id), 0) + 1;
  }

  private nextName(courseId: number, courseSectionId: number): string {
    return `Question Bank ${this.listForSection(courseId, courseSectionId).length + 1}`;
  }

  private contextKey(courseId: number, courseSectionId: number, bankId: number | null): string {
    return `${courseId}:${courseSectionId}:${bankId ?? 'new'}`;
  }
}
