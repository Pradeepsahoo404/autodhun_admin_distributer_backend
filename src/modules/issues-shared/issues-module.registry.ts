import { IssuesModuleSlug } from '@/constants/issuesModules';
import { getIssuesEntryModel } from './issues-entry.model';
import { IssuesEntryRepository } from './issues-entry.repository';
import { IssuesEntryService } from './issues-entry.service';
import { createIssuesEntryController } from './issues-entry.controller';
import { createIssuesEntryRoutes } from './issues-entry.routes';
import { Router } from 'express';

export interface RegisteredIssuesModule {
  slug: IssuesModuleSlug;
  apiPath: string;
  modelName: string;
  singularLabel: string;
  pluralLabel: string;
  exportFilePrefix: string;
  routes: Router;
  service: IssuesEntryService;
}

const NEW_ISSUES_MODULE_DEFS = [
  {
    slug: 'invalid-references' as const,
    apiPath: '/invalid-references',
    modelName: 'InvalidReference',
    singularLabel: 'Invalid reference',
    pluralLabel: 'Invalid references',
    exportFilePrefix: 'invalid-references',
  },
  {
    slug: 'ownership-transfers' as const,
    apiPath: '/ownership-transfers',
    modelName: 'OwnershipTransfer',
    singularLabel: 'Ownership transfer',
    pluralLabel: 'Ownership transfers',
    exportFilePrefix: 'ownership-transfers',
  },
  {
    slug: 'potential-claims' as const,
    apiPath: '/potential-claims',
    modelName: 'PotentialClaim',
    singularLabel: 'Potential claim',
    pluralLabel: 'Potential claims',
    exportFilePrefix: 'potential-claims',
  },
  {
    slug: 'disputed-claims' as const,
    apiPath: '/disputed-claims',
    modelName: 'DisputedClaim',
    singularLabel: 'Disputed claim',
    pluralLabel: 'Disputed claims',
    exportFilePrefix: 'disputed-claims',
  },
  {
    slug: 'appealed-claims' as const,
    apiPath: '/appealed-claims',
    modelName: 'AppealedClaim',
    singularLabel: 'Appealed claim',
    pluralLabel: 'Appealed claims',
    exportFilePrefix: 'appealed-claims',
  },
];

function registerIssuesModule(def: (typeof NEW_ISSUES_MODULE_DEFS)[number]): RegisteredIssuesModule {
  const model = getIssuesEntryModel(def.modelName);
  const repository = new IssuesEntryRepository(model);
  const service = new IssuesEntryService(repository, {
    moduleSlug: def.slug,
    singularLabel: def.singularLabel,
    pluralLabel: def.pluralLabel,
    exportFilePrefix: def.exportFilePrefix,
  });
  const controller = createIssuesEntryController(service, {
    singular: def.singularLabel,
    plural: def.pluralLabel,
    exportFilePrefix: def.exportFilePrefix,
  });
  const routes = createIssuesEntryRoutes(def.slug, controller);

  return {
    slug: def.slug,
    apiPath: def.apiPath,
    modelName: def.modelName,
    singularLabel: def.singularLabel,
    pluralLabel: def.pluralLabel,
    exportFilePrefix: def.exportFilePrefix,
    routes,
    service,
  };
}

export const registeredIssuesModules: RegisteredIssuesModule[] =
  NEW_ISSUES_MODULE_DEFS.map(registerIssuesModule);

export const issuesModuleRoutesByPath = Object.fromEntries(
  registeredIssuesModules.map((mod) => [mod.apiPath, mod.routes]),
) as Record<string, Router>;
