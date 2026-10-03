import { useMemo } from 'react';
import { useApp } from '../../state/AppContext';
import {
  frameworkStatus, complianceControls, complianceTasks, evidenceRegister, requirementGroups, evidencePipeline, riskRegister, biaRegister, assetRegister, attentionQueue,
} from '../../data/modules/comply';
import { streamWorkflows, trainingCourses, driveTree, vendorRegister, grcIncidents } from '../../data/modules/complyRegisters';

/** Memoised HexaComply registers for the current customer and tenant scope. */
export function useComplyData() {
  const { customer: c, tenantId } = useApp();
  return useMemo(() => {
    const fws = frameworkStatus(c, tenantId);
    const controls = complianceControls(c, tenantId);
    const tasks = complianceTasks(c, tenantId, controls);
    const evidence = evidenceRegister(c, tenantId, tasks, controls);
    const groups = requirementGroups(c, tenantId, controls);
    const pipeline = evidencePipeline(c, tenantId);
    return { fws, controls, tasks, evidence, groups, pipeline };
  }, [c, tenantId]);
}

export function useRiskData() {
  const { customer: c, tenantId } = useApp();
  return useMemo(() => riskRegister(c, tenantId), [c, tenantId]);
}

export function useContinuityData() {
  const { customer: c, tenantId } = useApp();
  return useMemo(() => ({ bia: biaRegister(c, tenantId), assets: assetRegister(c, tenantId), attention: attentionQueue(c, tenantId) }), [c, tenantId]);
}

/** The remaining Compliance workspace registers: stream, drive, vendors, incidents. */
export function useWorkspaceData() {
  const { customer: c, tenantId } = useApp();
  const { controls, tasks, evidence } = useComplyData();
  return useMemo(() => ({
    workflows: streamWorkflows(controls),
    training: trainingCourses(c),
    drive: driveTree(c, tasks, evidence),
    vendorsReg: vendorRegister(c, tenantId),
    incidents: grcIncidents(c, tenantId),
  }), [c, tenantId, controls, tasks, evidence]);
}

/** Original evidence colours: in-flight greys, waiting orange, approved green, failures red. */
export const EV_HEX: Record<string, string> = {
  draft: '#aeb6c3', submitted: '#7c8598', processing: '#4f5869', more_info: '#c2590b', approved: '#0e7a5a', rejected: '#c03636', expired: '#e08a8a', failed: '#99292a',
};
export const EV_CLASSES: string[][] = [['draft', 'submitted', 'processing'], ['more_info'], ['approved'], ['rejected', 'expired', 'failed']];
