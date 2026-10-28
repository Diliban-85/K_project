import React, { useMemo } from 'react';
import { SchoolPaper, PaperSection, PaperQuestion, ChoiceGroup } from '../types';
import { calculatePaperStats } from '../utils/pdfEngine';

interface DeterministicExamPaperProps {
  paper: SchoolPaper;
  activePageIndex?: number; // 1-indexed, if specified only renders that page, otherwise all pages
  onTotalPagesCalculated?: (totalPages: number) => void;
  pageRefs?: React.MutableRefObject<(HTMLDivElement | null)[]>;
}

interface ExamRenderItem {
  id: string;
  type: 'section_header' | 'question' | 'choice_group';
  sectionIndex: number;
  section: PaperSection;
  globalQuestionNumber?: number;
  isCompulsory?: boolean;
  question?: PaperQuestion;
  choiceGroup?: {
    group: ChoiceGroup;
    questions: PaperQuestion[];
  };
  estimatedHeight: number; // in approximate units
}

export const DeterministicExamPaper: React.FC<DeterministicExamPaperProps> = ({
  paper,
  activePageIndex,
  onTotalPagesCalculated,
  pageRefs,
}) => {
  const stats = useMemo(() => calculatePaperStats(paper), [paper]);

  // Flatten the paper into a deterministic list of renderable items with numbering and estimated heights
  const flattenedItems = useMemo(() => {
    const items: ExamRenderItem[] = [];
    const sections = paper.sections || [];

    for (let secIdx = 0; secIdx < sections.length; secIdx++) {
      const section = sections[secIdx];
      const secInfo = stats.sectionMap[section.id];
      const secQuestions = section.questions || [];
      const secChoiceGroups = section.choiceGroups || [];

      // Add Section Header item
      items.push({
        id: `sec_hdr_${section.id}`,
        type: 'section_header',
        sectionIndex: secIdx,
        section,
        estimatedHeight: section.instructions ? 80 : 50,
      });

      // Group questions into standalone questions and choice groups
      const processedChoiceGroups = new Set<string>();
      let qCounter = secInfo?.startNumber || 1;

      for (const q of secQuestions) {
        if (q.choiceGroupId) {
          if (!processedChoiceGroups.has(q.choiceGroupId)) {
            processedChoiceGroups.add(q.choiceGroupId);
            const group = secChoiceGroups.find((g) => g.id === q.choiceGroupId) || {
              id: q.choiceGroupId,
              paperId: paper.id,
              sectionId: section.id,
              position: q.position,
              label: 'Answer either Option A OR Option B:',
              marks: q.marks,
              createdAt: '',
              updatedAt: '',
            };
            const groupQuestions = secQuestions.filter((item) => item.choiceGroupId === q.choiceGroupId);
            const isCompulsory = secInfo?.compulsoryNumbers.includes(qCounter);

            items.push({
              id: `choice_${group.id}`,
              type: 'choice_group',
              sectionIndex: secIdx,
              section,
              globalQuestionNumber: qCounter,
              isCompulsory,
              choiceGroup: {
                group,
                questions: groupQuestions,
              },
              estimatedHeight: 180 + (groupQuestions.some((gq) => gq.visualAssetUrl) ? 140 : 0),
            });
            qCounter++;
          }
        } else {
          const isCompulsory = secInfo?.compulsoryNumbers.includes(qCounter) || q.isCompulsory;
          const isVisual = Boolean(q.visualAssetUrl);

          items.push({
            id: `q_${q.id}`,
            type: 'question',
            sectionIndex: secIdx,
            section,
            globalQuestionNumber: qCounter,
            isCompulsory,
            question: q,
            estimatedHeight: isVisual ? 170 : Math.max(50, Math.min(180, (q.questionText?.length || 50) * 0.5)),
          });
          qCounter++;
        }
      }
    }

    return items;
  }, [paper, stats]);

  // Deterministically partition items into A4 pages based on capacity
  const pages = useMemo(() => {
    const pageBuckets: ExamRenderItem[][] = [];
    if (flattenedItems.length === 0) {
      return [[]];
    }

    // Page 1 has top exam header (~220 units reserved), so available capacity is ~720 units
    // Subsequent pages have running header (~50 units reserved), so capacity is ~890 units
    const FIRST_PAGE_CAPACITY = 720;
    const SUBSEQUENT_PAGE_CAPACITY = 890;

    let currentPageItems: ExamRenderItem[] = [];
    let currentCapacity = FIRST_PAGE_CAPACITY;
    let currentUsed = 0;

    for (let i = 0; i < flattenedItems.length; i++) {
      const item = flattenedItems[i];
      const isHeader = item.type === 'section_header';
      const nextItem = flattenedItems[i + 1];

      // Orphan avoidance: If item is a section header and there's no room for its first question, move to next page
      let itemWeight = item.estimatedHeight;
      if (isHeader && nextItem) {
        itemWeight += Math.min(nextItem.estimatedHeight, 100);
      }

      if (currentUsed + itemWeight > currentCapacity && currentPageItems.length > 0) {
        pageBuckets.push(currentPageItems);
        currentPageItems = [item];
        currentCapacity = SUBSEQUENT_PAGE_CAPACITY;
        currentUsed = item.estimatedHeight;
      } else {
        currentPageItems.push(item);
        currentUsed += item.estimatedHeight;
      }
    }

    if (currentPageItems.length > 0) {
      pageBuckets.push(currentPageItems);
    }

    return pageBuckets.length > 0 ? pageBuckets : [[]];
  }, [flattenedItems]);

  const totalPages = pages.length;

  React.useEffect(() => {
    if (onTotalPagesCalculated) {
      onTotalPagesCalculated(totalPages);
    }
  }, [totalPages, onTotalPagesCalculated]);

  // If activePageIndex is specified, we filter for that specific page, but preserve overall page number
  const pagesToRender = useMemo(() => {
    if (activePageIndex && activePageIndex > 0 && activePageIndex <= totalPages) {
      return [{ pageNum: activePageIndex, items: pages[activePageIndex - 1] }];
    }
    return pages.map((items, idx) => ({ pageNum: idx + 1, items }));
  }, [pages, activePageIndex, totalPages]);

  return (
    <div className="flex flex-col items-center gap-8 print:gap-0 print:m-0">
      {pagesToRender.map(({ pageNum, items }, pageIdx) => {
        const isFirstPage = pageNum === 1;
        const isLastPage = pageNum === totalPages;

        return (
          <div
            key={`page-${pageNum}`}
            ref={(el) => {
              if (pageRefs && pageRefs.current) {
                pageRefs.current[pageNum - 1] = el;
              }
            }}
            id={`exam-page-${pageNum}`}
            className="w-[210mm] min-h-[297mm] bg-white text-black font-exam p-[16mm] sm:p-[18mm] shadow-md print:shadow-none print:m-0 print:p-[15mm] border border-neutral-300 print:border-none flex flex-col justify-between select-text page-break-after-always"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Page Content Container */}
            <div className="flex-1 flex flex-col">
              {/* First Page Header */}
              {isFirstPage ? (
                <div className="border-b-2 border-black pb-3 mb-5 text-center">
                  {/* School Name */}
                  {paper.schoolName && (
                    <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wide mb-1 text-black">
                      {paper.schoolName}
                    </h1>
                  )}

                  {/* Examination Name */}
                  <h2 className="text-base sm:text-lg font-bold uppercase tracking-normal mb-3 text-black">
                    {paper.examinationName}
                  </h2>

                  {/* Metadata Matrix */}
                  <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm font-semibold border-t border-black/30 pt-2 text-left">
                    <div>
                      <span>Class: </span>
                      <span className="font-normal">{paper.class?.name || '__________'}</span>
                    </div>
                    <div className="text-center">
                      <span>Subject: </span>
                      <span className="font-normal">{paper.subject?.name || '__________'}</span>
                    </div>
                    <div className="text-right">
                      <span>Max. Marks: </span>
                      <span className="font-bold">{paper.totalMarks}</span>
                    </div>
                    <div>
                      <span>Date: </span>
                      <span className="font-normal">{paper.date || '__________'}</span>
                    </div>
                    <div className="text-center">
                      <span>Duration: </span>
                      <span className="font-normal">{paper.duration || '3 Hours'}</span>
                    </div>
                    <div className="text-right text-[11px] text-neutral-600 print:text-black">
                      <span>Code: </span>
                      <span className="font-mono">{paper.subject?.code || 'GEN-01'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Running Header for Subsequent Pages (Page 2+) */
                <div className="border-b border-black pb-1.5 mb-4 flex items-center justify-between text-[11px] font-semibold text-neutral-800 print:text-black">
                  <span>
                    {paper.schoolName ? `${paper.schoolName} — ` : ''}
                    {paper.examinationName}
                  </span>
                  <span>
                    Class: {paper.class?.name} | Subject: {paper.subject?.name}
                  </span>
                </div>
              )}

              {/* Items Rendered on this Page */}
              <div className="space-y-4 flex-1">
                {items.map((item) => {
                  if (item.type === 'section_header') {
                    const section = item.section;
                    const secInfo = stats.sectionMap[section.id];
                    const toAnswer = Number(section.questionsToAnswer || section.targetQuestions || section.questionsProvided || 0);
                    const marksPerQ = Number(section.marksPerQuestion) || 1;
                    const subtotal = toAnswer * marksPerQ;

                    return (
                      <div
                        key={item.id}
                        className="text-center pt-2 pb-1 border-b border-dashed border-black/40 page-break-inside-avoid"
                      >
                        <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-black">
                          {section.name}
                          {subtotal > 0 && (
                            <span className="text-xs sm:text-sm font-normal ml-2">
                              ({toAnswer} × {marksPerQ} = {subtotal} Marks)
                            </span>
                          )}
                        </h3>

                        {/* Part Specific Instruction (No General Instructions header) */}
                        {section.instructions && section.instructions.trim().length > 0 && (
                          <p className="text-xs sm:text-[13px] italic text-neutral-800 print:text-black mt-0.5">
                            {section.instructions.trim()}
                          </p>
                        )}
                      </div>
                    );
                  }

                  if (item.type === 'question' && item.question) {
                    const q = item.question;
                    const qNum = item.globalQuestionNumber || 1;

                    return (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-3 text-xs sm:text-sm text-black leading-relaxed page-break-inside-avoid"
                      >
                        {/* Question Number & Body */}
                        <div className="flex items-start gap-2 flex-1">
                          <span className="font-bold min-w-[24px] text-right">{qNum}.</span>
                          <div className="flex-1 space-y-1.5">
                            {/* Visual Question Image */}
                            {q.visualAssetUrl && (
                              <div className="my-1 max-w-full overflow-hidden">
                                <img
                                  src={q.visualAssetUrl}
                                  alt={`Question ${qNum}`}
                                  referrerPolicy="no-referrer"
                                  className="max-w-full max-h-[300px] object-contain border border-black/20 bg-white"
                                  style={{ imageRendering: '-webkit-optimize-contrast' }}
                                />
                              </div>
                            )}

                            {/* Question Text */}
                            {q.questionText && q.questionText !== '[Visual Question]' && (
                              <p className="whitespace-pre-wrap">{q.questionText}</p>
                            )}

                            {/* Compulsory Tag */}
                            {item.isCompulsory && (
                              <span className="inline-block text-[10px] font-bold uppercase tracking-wider border border-black px-1.5 py-0.2 mt-0.5">
                                Compulsory
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Allocated Marks */}
                        <div className="text-right font-bold text-xs sm:text-sm whitespace-nowrap pl-2">
                          [{q.marks}]
                        </div>
                      </div>
                    );
                  }

                  if (item.type === 'choice_group' && item.choiceGroup) {
                    const { group, questions: groupQs } = item.choiceGroup;
                    const qNum = item.globalQuestionNumber || 1;
                    const optA = groupQs[0];
                    const optB = groupQs[1];

                    return (
                      <div
                        key={item.id}
                        className="border-l-2 border-black/40 pl-3 my-2 space-y-2 text-xs sm:text-sm text-black leading-relaxed page-break-inside-avoid break-inside-avoid"
                      >
                        {item.isCompulsory && (
                          <div className="pb-1">
                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider border border-black px-1.5 py-0.2">
                              Compulsory (Choose either A or B)
                            </span>
                          </div>
                        )}

                        {/* Option A */}
                        {optA && (
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 flex-1">
                              <span className="font-bold min-w-[24px] text-right">{qNum}. (a)</span>
                              <div className="flex-1 space-y-1">
                                {optA.visualAssetUrl && (
                                  <div className="my-1 max-w-full">
                                    <img
                                      src={optA.visualAssetUrl}
                                      alt={`Question ${qNum} Option A`}
                                      referrerPolicy="no-referrer"
                                      className="max-w-full max-h-[250px] object-contain border border-black/20 bg-white"
                                    />
                                  </div>
                                )}
                                {optA.questionText && optA.questionText !== '[Visual Question]' && (
                                  <p className="whitespace-pre-wrap">{optA.questionText}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right font-bold text-xs sm:text-sm whitespace-nowrap pl-2">
                              [{optA.marks}]
                            </div>
                          </div>
                        )}

                        {/* Centered OR Divider */}
                        <div className="text-center font-bold text-xs uppercase tracking-widest my-1 text-black">
                          — OR —
                        </div>

                        {/* Option B */}
                        {optB && (
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 flex-1">
                              <span className="font-bold min-w-[24px] text-right">&nbsp;&nbsp;&nbsp;&nbsp;(b)</span>
                              <div className="flex-1 space-y-1">
                                {optB.visualAssetUrl && (
                                  <div className="my-1 max-w-full">
                                    <img
                                      src={optB.visualAssetUrl}
                                      alt={`Question ${qNum} Option B`}
                                      referrerPolicy="no-referrer"
                                      className="max-w-full max-h-[250px] object-contain border border-black/20 bg-white"
                                    />
                                  </div>
                                )}
                                {optB.questionText && optB.questionText !== '[Visual Question]' && (
                                  <p className="whitespace-pre-wrap">{optB.questionText}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right font-bold text-xs sm:text-sm whitespace-nowrap pl-2">
                              [{optB.marks}]
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>

            {/* Page Footer */}
            <div className="border-t border-black/30 pt-2 mt-6 flex items-center justify-between text-[11px] text-neutral-800 print:text-black">
              <span className="font-serif italic">{paper.subject?.name || 'Examination'}</span>
              <span className="font-bold tracking-wider">
                Page {pageNum} of {totalPages}
              </span>
              <span className="font-serif italic">
                {isLastPage ? '*** End of Paper ***' : '[Turn Over]'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
