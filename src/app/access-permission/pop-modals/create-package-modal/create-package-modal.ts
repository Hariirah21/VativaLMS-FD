import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { buildPackageDetailsForm, wordCountOf } from '../forms/package-form';
import { AVAILABLE_PACKAGE_OPTIONS, AvailablePackage, PackagePayload, PackageRecord } from '../../../services/package.service';


@Component({
  selector: 'app-create-package-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './create-package-modal.html',
  styleUrl: './create-package-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatePackageModal implements OnChanges {
  /** Existing packages, for the client-side duplicate-name check. */
  @Input({ required: true }) existingPackages: readonly PackageRecord[] = [];
  @Input() packageToEdit: PackageRecord | null = null;
  @Input() submitting = false;
  @Input() serverError = '';
  @Output() readonly cancelled = new EventEmitter<void>();
  @Output() readonly next = new EventEmitter<PackagePayload>();

  protected readonly availablePackageOptions = AVAILABLE_PACKAGE_OPTIONS;
  protected readonly billingCycleOptions = ['Monthly', 'Yearly'] as const;
  protected availablePackageDropdownOpen = false;
  protected billingCycleDropdownOpen = false;
  protected readonly form = buildPackageDetailsForm(
    () => this.existingPackages,
    () => this.packageToEdit?.id ?? null,
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['packageToEdit']) return;
    this.closeDropdowns();
    this.form.reset();
    const item = this.packageToEdit;
    if (!item) return;

    this.form.patchValue({
      name: item.name,
      availablePackage: item.availablePackage,
      description: item.description ?? '',
      price: item.price,
      billingCycle: item.billingCycle,
      userLimit: item.userLimit,
      storageLimit: item.storageLimit,
    });
  }

  protected descriptionWordCount(): number {
    return wordCountOf(this.form.controls.description.value);
  }

  protected toggleAvailablePackageDropdown(): void {
    this.availablePackageDropdownOpen = !this.availablePackageDropdownOpen;
    if (this.availablePackageDropdownOpen) this.billingCycleDropdownOpen = false;
  }

  protected toggleBillingCycleDropdown(): void {
    this.billingCycleDropdownOpen = !this.billingCycleDropdownOpen;
    if (this.billingCycleDropdownOpen) this.availablePackageDropdownOpen = false;
  }

  protected selectAvailablePackage(option: AvailablePackage): void {
    this.form.controls.availablePackage.setValue(option);
    this.form.controls.availablePackage.markAsTouched();
    this.closeDropdowns();
  }

  protected selectBillingCycle(cycle: 'Monthly' | 'Yearly'): void {
    this.form.controls.billingCycle.setValue(cycle);
    this.form.controls.billingCycle.markAsTouched();
    this.closeDropdowns();
  }

  private closeDropdowns(): void {
    this.availablePackageDropdownOpen = false;
    this.billingCycleDropdownOpen = false;
  }

  protected preventNonNumericPriceInput(event: KeyboardEvent): void {
    if (
      ['e', 'E', '+', '-'].includes(event.key) &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
    }
  }

  protected preventNonIntegerInput(event: KeyboardEvent): void {
    if (
      ['e', 'E', '+', '-', '.', ','].includes(event.key) &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
    }
  }

  protected onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    this.next.emit({
      name: value.name.trim(),
      availablePackage: value.availablePackage as PackagePayload['availablePackage'],
      description: value.description.trim() || null,
      price: value.price!,
      billingCycle: value.billingCycle as PackagePayload['billingCycle'],
      userLimit: value.userLimit!,
      storageLimit: value.storageLimit,
      permissions: this.packageToEdit?.permissions ?? [],
    });
  }

  /** Called by the container after a successful create, or on reopen. */
  reset(): void {
    this.form.reset();
  }

  /**
   * Surfaces a server-side 409 (duplicate name) back onto the name field
   * without the component needing to know anything about HTTP.
   */
  markNameAsDuplicate(): void {
    const control = this.form.controls.name;
    control.setErrors({ ...control.errors, packageNameExists: true });
    control.markAsTouched();
  }
}