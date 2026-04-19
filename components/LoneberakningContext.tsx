/**
 * Bakåtkompatibilitets-shim.
 * All logik finns nu i AppContext.tsx.
 * Befintliga importer från LoneberakningContext fortsätter fungera utan ändringar.
 */
export {
  AppProvider as LoneberakningProvider,
  useAppContext as useLoneberakningContext,
  ALLOWANCES,
  type EmploymentType,
  type AllowanceKey,
  type AllowanceAmounts,
  type GroundSalarySelection,
  type SavedMonth,
  type SavedPayslip,
} from '@/components/AppContext';