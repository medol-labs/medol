import type { MedolImportReference, MedolSource } from './dslParser';

const identityAccessManagementMedol = String.raw`
domain IdentityAccessManagement {
  context IdentityAccessManagement {
    slice RegisterUserAccount {
      startsLifecycle
      actor IdentityAdministrator

      command RegisterUserAccount {
        userAccountId: UUID id generated technical
        username: String
        providerSubject: String?
        organizationId: UUID?
      }

      event UserAccountRegistered {
        userAccountId: UUID id technical
        username: String
        providerSubject: String?
        organizationId: UUID?
      }

      state Active
    }

    slice DeactivateUserAccount {
      actor IdentityAdministrator

      command DeactivateUserAccount {
        userAccountId: UUID id technical
        reason: String
      }

      event UserAccountDeactivated {
        userAccountId: UUID id technical
        reason: String
      }

      state Deactivated
    }

    slice RegisterRole {
      startsLifecycle
      actor IdentityAdministrator

      command RegisterRole {
        roleCode: String id
        roleName: String
      }

      event RoleRegistered {
        roleCode: String id
        roleName: String
      }

      state Registered
    }

    slice GrantPermissionToRole {
      actor IdentityAdministrator

      command GrantPermissionToRole {
        roleCode: String id
        permissionCode: String
      }

      event PermissionGrantedToRole {
        roleCode: String id
        permissionCode: String
      }
    }

    slice AssignRoleToUser {
      actor IdentityAdministrator

      command AssignRoleToUser {
        userAccountId: UUID id technical
        roleCode: String
      }

      event RoleAssignedToUser {
        userAccountId: UUID id technical
        roleCode: String
      }
    }

    slice IdentityAccessCatalogs {
      actor IdentityAdministrator

      readmodel UserAccountCatalog[] {
        userAccountId: UUID id
        username: String display
        providerSubject: String?
        organizationId: UUID?
        active: Boolean
        subscribe UserAccountRegistered
        subscribe UserAccountDeactivated
        subscribe RoleAssignedToUser
      }

      readmodel RoleCatalog[] {
        roleCode: String id display
        roleName: String display
        permissionCodes: String[]
        subscribe RoleRegistered
        subscribe PermissionGrantedToRole
      }
    }

    concept UserAccount {
      state Active
      state Deactivated
      slice RegisterUserAccount
      slice DeactivateUserAccount
      slice AssignRoleToUser
    }

    concept Role {
      state Registered
      slice RegisterRole
      slice GrantPermissionToRole
    }
  }
}
`;

export const builtinMedolModels = new Map<string, string>([
  ['identity-access-management', identityAccessManagementMedol],
  ['identityAccessManagement', identityAccessManagementMedol],
  ['iam', identityAccessManagementMedol]
]);

export const resolveBuiltinMedolImport = (
  imported: MedolImportReference
): MedolSource | undefined => {
  const moduleName = imported.module ?? '';
  const source = builtinMedolModels.get(moduleName);
  if (!source) return undefined;
  return {
    sourceName: `<builtin:${moduleName}>`,
    text: appendBuiltinDeployment(source, imported.deployment)
  };
};

export const supportedBuiltinMedolImports = (): string[] => [...builtinMedolModels.keys()];

const appendBuiltinDeployment = (text: string, deployment?: string): string => {
  const normalizedDeployment = deployment?.trim() || extractBuiltinContextName(text);
  return `${text}

deployment ${normalizedDeployment} {
  includes ${extractBuiltinContextName(text)}
}
`;
};

const extractBuiltinContextName = (text: string): string => {
  const match = text.match(/\bcontext\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
  return match?.[1] ?? 'IdentityAccessManagement';
};
