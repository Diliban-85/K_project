import React from 'react';
import { FileText, FolderOpen, Files, Settings2, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { ActiveTab } from '../types';

interface PlaceholderRouteProps {
  tab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
}

export const PlaceholderRoute: React.FC<PlaceholderRouteProps> = ({ tab, onNavigate }) => {
  const meta: Record<
    string,
    {
      title: string;
      subtitle: string;
      icon: React.ComponentType<{ className?: string }>;
      phaseNotice: string;
      prerequisitesMet: string[];
      nextPhaseScope: string[];
    }
  > = {
    'create-paper': {
      title: 'Create Question Paper',
      subtitle: 'Author and configure examination question papers',
      icon: FileText,
      phaseNotice: 'Scheduled for Phase 2 Implementation',
      prerequisitesMet: [
        'Teacher authenticated session active',
        'Teacher-owned class management established',
        'Teacher-owned subject associations configured',
      ],
      nextPhaseScope: [
        'Curriculum blueprint selection',
        'Question schema and taxonomy configuration',
        'AI generation and manual question insertion',
        'PDF layout generation and print preview',
      ],
    },
    resources: {
      title: 'Teaching & Reference Resources',
      subtitle: 'Curriculum standards, textbooks, and teacher resource library',
      icon: FolderOpen,
      phaseNotice: 'Scheduled for Phase 2 Implementation',
      prerequisitesMet: [
        'Database foundations and teacher account isolation active',
        'Subject and grade relationships established',
      ],
      nextPhaseScope: [
        'Document and syllabus PDF upload pipeline',
        'Document processing and section extraction',
        'Reference question bank tagging',
      ],
    },
    papers: {
      title: 'Saved Question Papers',
      subtitle: 'Historical repository of authored exam papers and answer keys',
      icon: Files,
      phaseNotice: 'Scheduled for Phase 2 Implementation',
      prerequisitesMet: [
        'Prisma relational schema for teachers, classes, and subjects',
        'Server-side ownership verification',
      ],
      nextPhaseScope: [
        'Draft and published examination records',
        'Paper versioning and duplication for re-tests',
        'Export to Word and printable PDF formats',
      ],
    },
    'exam-patterns': {
      title: 'Exam Patterns & Blueprints',
      subtitle: 'Formative, summative, and board assessment mark distribution templates',
      icon: Settings2,
      phaseNotice: 'Scheduled for Phase 2 Implementation',
      prerequisitesMet: [
        'Teacher profile and school department hierarchy active',
        'Subject course code associations ready',
      ],
      nextPhaseScope: [
        'Section structure (MCQs, Short Answer, Essay/Long)',
        'Difficulty weighting matrices (Bloom taxonomy)',
        'Marks distribution blueprints per academic term',
      ],
    },
  };

  const current = meta[tab] || {
    title: 'Module In Preparation',
    subtitle: 'Academic assessment workspace',
    icon: Clock,
    phaseNotice: 'Phase 1 Foundation Complete',
    prerequisitesMet: ['Phase 1 data models and security active'],
    nextPhaseScope: ['Upcoming in subsequent phase'],
  };

  const Icon = current.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{current.title}</h1>
            <p className="text-sm text-slate-500">{current.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Honest placeholder notice */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-start space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 border border-blue-200 shrink-0 mt-0.5">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              {current.phaseNotice}
            </span>
            <h3 className="mt-2 text-base font-semibold text-slate-900">
              Foundation Active: Ready for Phase 2 Pipeline
            </h3>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              Per system directive, Phase 1 establishes the rock-solid project foundation, Prisma
              database schema, real authentication, strict teacher authorization, and Class/Subject
              management. Document processing, AI generation, and PDF compilation will be connected in
              Phase 2.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-5">
          <div className="rounded-md bg-slate-50 p-4 border border-slate-200">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3 flex items-center space-x-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Phase 1 Requirements Met</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              {current.prerequisitesMet.map((item, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md bg-slate-50 p-4 border border-slate-200">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3 flex items-center space-x-1.5">
              <Clock className="h-4 w-4 text-slate-500" />
              <span>Phase 2 Deliverables</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              {current.nextPhaseScope.map((item, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <span className="text-slate-400 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            You can configure your classes and subjects in the meantime.
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => onNavigate('classes')}
              className="inline-flex items-center space-x-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            >
              <span>Manage Classes</span>
              <ArrowRight className="h-3 w-3" />
            </button>
            <button
              onClick={() => onNavigate('subjects')}
              className="inline-flex items-center space-x-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <span>Manage Subjects</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
