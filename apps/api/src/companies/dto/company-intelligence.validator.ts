import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  CAREER_ROLE_AREA_IDS,
  CAREER_ROLE_TRACK_IDS,
  INTERVIEW_ROUND_TYPES,
} from '@momito/shared';

// MOM-121 (D-017): the structured Company fields are Json, so class-validator's
// built-ins can't reach inside them. These constraints validate the shapes at the
// DTO boundary so garbage keys never reach readiness math or the catalog UI.

const AREA_IDS = new Set<string>(CAREER_ROLE_AREA_IDS);
const TRACK_IDS = new Set<string>(CAREER_ROLE_TRACK_IDS);
const ROUND_TYPES = new Set<string>(INTERVIEW_ROUND_TYPES);

@ValidatorConstraint({ name: 'focusAreas', async: false })
class FocusAreasConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined) return true;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    return Object.entries(value as Record<string, unknown>).every(
      ([area, weight]) => AREA_IDS.has(area) && typeof weight === 'number' && weight >= 1 && weight <= 5,
    );
  }
  defaultMessage(): string {
    return `focusAreas must be an object mapping a valid area id (${CAREER_ROLE_AREA_IDS.join(', ')}) to a weight 1–5`;
  }
}

@ValidatorConstraint({ name: 'roleTrackIds', async: false })
class RoleTrackIdsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined) return true;
    return Array.isArray(value) && value.every((id) => typeof id === 'string' && TRACK_IDS.has(id));
  }
  defaultMessage(): string {
    return 'roleTrackIds must be an array of valid career role track ids';
  }
}

@ValidatorConstraint({ name: 'interviewProcess', async: false })
class InterviewProcessConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined) return true;
    if (!Array.isArray(value)) return false;
    return value.every((stage) => {
      if (typeof stage !== 'object' || stage === null) return false;
      const s = stage as Record<string, unknown>;
      return (
        typeof s.roundType === 'string' &&
        ROUND_TYPES.has(s.roundType) &&
        typeof s.label === 'string' &&
        (s.notes === undefined || typeof s.notes === 'string')
      );
    });
  }
  defaultMessage(): string {
    return 'interviewProcess must be an array of { roundType (a valid round type), label, notes? }';
  }
}

function register(constraint: new () => ValidatorConstraintInterface, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({ target: object.constructor, propertyName, options, validator: constraint });
}

export const IsFocusAreas = (options?: ValidationOptions) => register(FocusAreasConstraint, options);
export const IsRoleTrackIds = (options?: ValidationOptions) => register(RoleTrackIdsConstraint, options);
export const IsInterviewProcess = (options?: ValidationOptions) => register(InterviewProcessConstraint, options);
