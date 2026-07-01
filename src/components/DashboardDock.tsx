import { useEffect, useState, useRef } from "react";
import { fetchEntities, formatEntityName, type Entity } from "@/lib/finance";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";

interface DockItem {
  id: string;
  entity: string;
  term: string;
  from: string;
  to: string;
}

interface DashboardDockProps {
  views: DockItem[];
  onReorder: (newViews: DockItem[]) => void;
  onRemove: (id: string) => void;
  activeMatrixId?: string;
}

interface SortableDockItemProps {
  view: DockItem;
  isActive: boolean;
  entityName: string;
  dateRange: string;
  onClick: () => void;
  onRemove: () => void;
}

function SortableDockItem({
  view,
  isActive,
  entityName,
  dateRange,
  onClick,
  onRemove,
}: SortableDockItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: view.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative shrink-0 flex items-center justify-center gap-1 px-1 py-1.5 rounded-md transition-all duration-300 min-w-[80px] max-w-[120px] hover:bg-[#0268c7] text-white/70 hover:text-white`}
    >
      {/* Grip Handle */}
      <div
        {...attributes}
        {...listeners}
        className={`cursor-grab active:cursor-grabbing p-0.5 shrink-0 transition-colors duration-300 text-white/50 hover:text-white`}
      >
        <GripVertical className="h-3 w-3" />
      </div>

      <div
        className="flex flex-col items-center justify-center select-none cursor-pointer w-full px-1 overflow-hidden"
        onClick={onClick}
      >
        <span
          className={`text-xs font-medium truncate w-full text-center transition-colors duration-300 text-white`}
        >
          {entityName}
        </span>
        <span
          className={`text-[9px] truncate w-full text-center transition-colors duration-300 text-white/70`}
        >
          {dateRange}
        </span>
      </div>

      {/* Close button */}
      <div className="flex items-center justify-center shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={`flex items-center justify-center h-4 w-4 rounded-full transition-colors duration-200 cursor-pointer text-white/70 hover:text-red-600 hover:bg-red-100`}
          title="Remove View"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

export function DashboardDock({ views, onReorder, onRemove, activeMatrixId }: DashboardDockProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [scrollMetrics, setScrollMetrics] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
  });
  const scrollbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: any) => setScrollMetrics(e.detail);
    window.addEventListener("pnl-scroll-metrics", handler);
    return () => window.removeEventListener("pnl-scroll-metrics", handler);
  }, []);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollbarRef.current || scrollMetrics.scrollWidth <= 0) return;
    const rect = scrollbarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercentage = clickX / rect.width;
    const newScrollLeft = clickPercentage * scrollMetrics.scrollWidth;
    const centeredScrollLeft = newScrollLeft - scrollMetrics.clientWidth / 2;

    window.dispatchEvent(new CustomEvent("pnl-scroll-to", { detail: centeredScrollLeft }));
  };

  const showIndicator = scrollMetrics.scrollWidth > scrollMetrics.clientWidth;
  const widthPercentage =
    scrollMetrics.scrollWidth > 0
      ? (scrollMetrics.clientWidth / scrollMetrics.scrollWidth) * 100
      : 0;
  const leftPercentage =
    scrollMetrics.scrollWidth > 0
      ? (scrollMetrics.scrollLeft / scrollMetrics.scrollWidth) * 100
      : 0;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // enable dragging only after moving 5px (keeps normal clicks functional)
      },
    }),
  );

  useEffect(() => {
    fetchEntities().then(setEntities);
  }, []);

  useEffect(() => {
    if (views.length <= 1) {
      setActiveId(null);
      return;
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      let maxRatio = 0;
      let activeCardId = activeId;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          activeCardId = entry.target.id.replace("card-", "");
        }
      });

      if (activeCardId && activeCardId !== activeId) {
        setActiveId(activeCardId);
      }
    };

    const observerOptions = {
      root: null,
      rootMargin: "0px -20% 0px -20%",
      threshold: [0, 0.25, 0.5, 0.75, 1.0],
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    views.forEach((view) => {
      const el = document.getElementById(`card-${view.id}`);
      if (el) {
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [views, activeId]);

  if (views.length <= 1) return null;

  const handleScrollToCard = (id: string) => {
    const el = document.getElementById(`card-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = views.findIndex((v) => v.id === active.id);
      const newIndex = views.findIndex((v) => v.id === over.id);
      onReorder(arrayMove(views, oldIndex, newIndex));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="fixed bottom-1.5 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-1.5 w-max max-w-[90vw] bg-white/50 backdrop-blur-xl p-1.5 rounded-[1.5rem] shadow-[0_4px_16px_rgba(0,0,0,0.1)] border border-white/60">
        <div className="flex flex-nowrap items-center gap-1 bg-[#037EF3] text-white rounded-full px-3 py-1.5 h-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full overflow-x-auto">
          <SortableContext items={views.map((v) => v.id)} strategy={horizontalListSortingStrategy}>
            {views.map((view) => {
              const isActive = activeMatrixId ? activeMatrixId === view.id : activeId === view.id;
              const matchedEntity = entities.find((e) => e.id === view.entity);

              // Map local state to requested display keys
              const rawEntityName =
                view.entity === "Select LC" ? "Unassigned LC" : matchedEntity?.name || "Unknown";
              const entityName = formatEntityName(rawEntityName);
              const dateRange =
                view.from && view.to
                  ? `${formatDate(view.from)} - ${formatDate(view.to)}`
                  : view.term || "No Date";

              return (
                <SortableDockItem
                  key={view.id}
                  view={view}
                  isActive={isActive}
                  entityName={entityName}
                  dateRange={dateRange}
                  onClick={() => handleScrollToCard(view.id)}
                  onRemove={() => onRemove(view.id)}
                />
              );
            })}
          </SortableContext>
        </div>

        {showIndicator && (
          <div className="w-[95%] px-1 pb-1">
            <div
              ref={scrollbarRef}
              onClick={handleTrackClick}
              className="w-full h-2 bg-black/10 rounded-full relative overflow-hidden cursor-pointer"
            >
              <div
                className="absolute top-0 h-full bg-[#037EF3] rounded-full pointer-events-none transition-all duration-75"
                style={{ width: `${widthPercentage}%`, left: `${leftPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
