import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User,
  UserRole,
  PermissionModule,
  PermissionAction,
  RolePermissionConfig,
  ConfidentialAccessRules,
  SecurityPolicyConfig,
} from '../types/index.ts';
import { api } from '../lib/api.ts';
import {
  getDefaultRolePermissionConfigs,
  getDefaultSecurityPolicy,
  evaluateUserPermission,
  getEffectiveConfidentialRules,
} from '../lib/securityCalculations.ts';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  isLoggedIn: boolean;
  roleConfigs: RolePermissionConfig[];
  confidential: ConfidentialAccessRules;
  securityPolicy: SecurityPolicyConfig;
  switchUser: (userId: string) => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  loginWithCredentials: (username: string, password?: string) => Promise<void>;
  loginAsUser: (userId: string) => Promise<void>;
  logoutSession: () => Promise<void>;
  refreshAuthAndPermissions: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
  hasPermission: (module: PermissionModule, action: PermissionAction) => boolean;
  authorizeAndLogAction: (
    module: PermissionModule,
    action: PermissionAction,
    description: string,
    entityId?: string
  ) => Promise<{ allowed: boolean; reason: string }>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [roleConfigs, setRoleConfigs] = useState<RolePermissionConfig[]>(
    getDefaultRolePermissionConfigs()
  );
  const [confidential, setConfidential] = useState<ConfidentialAccessRules>({
    canViewPurchasePrice: true,
    canViewProfitMargins: true,
    canViewBankSecrets: true,
    canViewSecurityLogs: true,
    maxAllowedDiscountPercent: 100,
  });
  const [securityPolicy, setSecurityPolicy] = useState<SecurityPolicyConfig>(
    getDefaultSecurityPolicy()
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kharrazi_logged_out') !== 'true';
    }
    return true;
  });

  const refreshAuthAndPermissions = useCallback(async () => {
    try {
      const [userList, myPerms] = await Promise.all([
        api.getUsers(),
        api.getMyPermissions(),
      ]);
      setUsers(userList);
      if (typeof window !== 'undefined' && localStorage.getItem('kharrazi_logged_out') === 'true') {
        setCurrentUser(null);
        setIsLoggedIn(false);
      } else {
        setCurrentUser(myPerms.user);
        setIsLoggedIn(true);
      }
      const effectiveRoleConfigs = myPerms.allRoleConfigs || getDefaultRolePermissionConfigs();
      setRoleConfigs(effectiveRoleConfigs);
      setConfidential(
        myPerms.confidential || getEffectiveConfidentialRules(myPerms.user, effectiveRoleConfigs)
      );
      if (myPerms.policy) {
        setSecurityPolicy(myPerms.policy);
      }
      api.setUserId(myPerms.user.id);
    } catch (error) {
      console.error('Failed to load auth & permissions:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await refreshAuthAndPermissions();
      setIsLoading(false);
    };
    init();
  }, [refreshAuthAndPermissions]);

  const switchUser = async (userId: string) => {
    try {
      const user = await api.switchUser(userId);
      setCurrentUser(user);
      setIsLoggedIn(true);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kharrazi_logged_out');
      }
      setConfidential(getEffectiveConfidentialRules(user, roleConfigs));
      await refreshAuthAndPermissions();
    } catch (err) {
      console.error('Switch user error:', err);
      const localMatch = users.find((u) => u.id === userId);
      if (localMatch) {
        api.setUserId(localMatch.id);
        setCurrentUser(localMatch);
        setIsLoggedIn(true);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('kharrazi_logged_out');
        }
        setConfidential(getEffectiveConfidentialRules(localMatch, roleConfigs));
      }
    }
  };

  const switchRole = async (role: UserRole) => {
    const targetUser = users.find((u) => u.role === role && u.isActive) || users.find((u) => u.role === role);
    if (targetUser) {
      await switchUser(targetUser.id);
    } else if (currentUser) {
      const updatedUser: User = { ...currentUser, role };
      setCurrentUser(updatedUser);
      setIsLoggedIn(true);
      setConfidential(getEffectiveConfidentialRules(updatedUser, roleConfigs));
    }
  };

  const loginWithCredentials = async (username: string, password?: string) => {
    const res = await api.login(username, password);
    setCurrentUser(res.user);
    setIsLoggedIn(true);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kharrazi_logged_out');
    }
    setConfidential(getEffectiveConfidentialRules(res.user, roleConfigs));
    await refreshAuthAndPermissions();
  };

  const loginAsUser = async (userId: string) => {
    await switchUser(userId);
  };

  const logoutSession = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('kharrazi_logged_out', 'true');
    }
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return roles.includes(currentUser.role);
  };

  const hasPermission = useCallback(
    (module: PermissionModule, action: PermissionAction): boolean => {
      if (!currentUser) return false;
      return evaluateUserPermission(currentUser, roleConfigs, module, action).allowed;
    },
    [currentUser, roleConfigs]
  );

  const authorizeAndLogAction = useCallback(
    async (
      module: PermissionModule,
      action: PermissionAction,
      description: string,
      entityId?: string
    ): Promise<{ allowed: boolean; reason: string }> => {
      try {
        const res = await api.authorizeAction({
          module,
          action,
          description,
          entityId,
        });
        return res;
      } catch (err: any) {
        return {
          allowed: false,
          reason: err.message || 'دسترسی به این عملیات توسط سرور مسدود شد.',
        };
      }
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoggedIn,
        users,
        roleConfigs,
        confidential,
        securityPolicy,
        switchUser,
        switchRole,
        loginWithCredentials,
        loginAsUser,
        logoutSession,
        refreshAuthAndPermissions,
        hasRole,
        hasPermission,
        authorizeAndLogAction,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
