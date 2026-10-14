import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { OrganizeSections } from './organize-sections';
import { Course } from '../course.model';
import { SectionManagementService } from '../../services/Section management.service';

describe('OrganizeSections', () => {
  let component: OrganizeSections;
  let fixture: ComponentFixture<OrganizeSections>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganizeSections],
      providers: [
        {
          provide: SectionManagementService,
          useValue: { getSections: () => of([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizeSections);
    const course: Course = {
      id: 1,
      name: 'Test Course',
      description: '',
      categoryId: 1,
      categoryName: 'Technical',
      instructorId: 1,
      instructorName: 'Instructor',
      level: 'BEGINNER',
      status: 'DRAFT',
      createdAt: '2026-10-14T00:00:00.000Z',
      updatedAt: '2026-10-14T00:00:00.000Z',
    };
    fixture.componentRef.setInput('course', course);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
