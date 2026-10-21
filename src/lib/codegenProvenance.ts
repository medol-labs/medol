import { version as medolVersion } from '../../package.json';
import type { ModelingWorkspaceVersion } from '../contracts/modelingWorkspace';
import type { CodegenModel } from './codegenModel';

export interface CodegenMetadata {
  schemaVersion: 1;
  medolVersion: string;
  source: {
    sha256: string;
    workspaceId?: string;
    versionId?: string;
    versionNo?: number;
    modelHash?: string;
    release?: { label?: string; channel: string; releasedAt?: string; notes?: string };
  };
}

export const normalizeReleaseLabel = (label: string): string => {
  const value = label.trim();
  if (!/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new Error('Release version must use vX.Y.Z, for example v1.0.0');
  }
  return value.startsWith('v') ? value : `v${value}`;
};

export const sourceSha256 = async (source: string): Promise<string> => {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const withCodegenProvenance = async (
  model: CodegenModel,
  dsl: string,
  options: {
    workspaceId?: string;
    version?: ModelingWorkspaceVersion;
    releaseLabel?: string;
  } = {}
): Promise<CodegenModel> => {
  if (options.version && options.version.dsl !== dsl) {
    throw new Error('Model version does not match exported source');
  }
  return {
    ...model,
    metadata: {
      schemaVersion: 1,
      medolVersion,
      source: {
        sha256: await sourceSha256(dsl),
        ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
        ...(options.version ? {
          versionId: options.version.id,
          versionNo: options.version.versionNo,
          modelHash: options.version.modelHash,
          ...(options.version.release ? { release: options.version.release } : {})
        } : {}),
        ...(options.releaseLabel ? {
          release: { channel: 'stable', label: normalizeReleaseLabel(options.releaseLabel) }
        } : {})
      }
    }
  };
};
