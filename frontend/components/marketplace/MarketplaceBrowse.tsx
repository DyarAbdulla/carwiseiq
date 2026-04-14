"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  MapPin,
  Calendar,
  Filter,
  X,
  Sparkles,
  Gauge,
  ArrowUpDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import type { CarListing } from "@/lib/database.types";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { listingImageUrl, isVideoUrl } from "@/lib/utils";
import { ListingCardSkeleton } from "@/components/common/LoadingSkeleton";

function firstImageUrl(images: unknown): string | null {
  if (!images || !Array.isArray(images)) return null;
  const first = images[0];
  if (typeof first === "string") return first;
  if (first && typeof (first as { url?: string }).url === "string")
    return (first as { url: string }).url;
  return null;
}

function conditionLabel(c: string): string {
  if (!c) return "";
  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
}

function conditionBadgeClass(c: string): string {
  const x = (c || "").toLowerCase();
  if (x === "excellent")
    return "bg-emerald-600/95 px-2.5 py-1.5 text-white shadow-sm border-emerald-400/40";
  if (x === "good")
    return "bg-blue-600/95 px-2.5 py-1.5 text-white shadow-sm border-blue-400/40";
  if (x === "fair")
    return "bg-amber-500/95 px-2.5 py-1.5 text-slate-900 shadow-sm border-amber-300/50";
  if (x === "poor")
    return "bg-red-600/95 px-2.5 py-1.5 text-white shadow-sm border-red-400/40";
  return "bg-slate-600/90 px-2.5 py-1.5 text-white shadow-sm border-white/20";
}

type SortMode = "newest" | "price_asc" | "price_desc";

function EmptySearchIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="20"
        y="60"
        width="160"
        height="50"
        rx="8"
        className="fill-violet-500/15 stroke-violet-400/40"
        strokeWidth="2"
      />
      <circle cx="55" cy="110" r="12" className="fill-slate-600" />
      <circle cx="145" cy="110" r="12" className="fill-slate-600" />
      <path
        d="M45 60 L55 40 L145 40 L155 60"
        className="stroke-violet-400/50"
        strokeWidth="2"
        fill="none"
      />
      <circle
        cx="100"
        cy="28"
        r="18"
        className="fill-emerald-500/20 stroke-emerald-400/50"
        strokeWidth="2"
      />
      <path
        d="M92 28 L98 34 L110 22"
        className="stroke-emerald-400"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MarketplaceBrowse() {
  const [listings, setListings] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showSoldCars, setShowSoldCars] = useState(true);
  const [priceSearchMode, setPriceSearchMode] = useState<"range" | "smart">(
    "range",
  );
  const [budget, setBudget] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [filters, setFilters] = useState({
    min_price: "",
    max_price: "",
    min_year: "",
    max_year: "",
    max_mileage: "",
  });
  const locale = useLocale();
  const t = useTranslations("marketplace");
  const { toast } = useToast();

  const budgetChips = [
    { label: "Under $5k", value: 5000 },
    { label: "$5k-$10k", min: 5000, max: 10000 },
    { label: "$10k-$20k", min: 10000, max: 20000 },
    { label: "$20k-$30k", min: 20000, max: 30000 },
    { label: "$30k-$50k", min: 30000, max: 50000 },
    { label: "$50k+", min: 50000, max: 200000 },
  ];

  const handleBudgetChipClick = (chip: (typeof budgetChips)[0]) => {
    if ("value" in chip && chip.value != null) {
      const v = chip.value;
      setBudget(v);
      setPriceSearchMode("smart");
      const calculatedMin = v * 0.85;
      const calculatedMax = v * 1.15;
      setFilters({
        ...filters,
        min_price: calculatedMin.toString(),
        max_price: calculatedMax.toString(),
      });
    } else {
      setBudget(null);
      setPriceSearchMode("range");
      setFilters({
        ...filters,
        min_price: chip.min.toString(),
        max_price: chip.max.toString(),
      });
    }
    loadListings();
  };

  const handleBudgetChange = (value: string) => {
    const numValue = value ? parseFloat(value) : null;
    setBudget(numValue);
    if (numValue && numValue > 0) {
      const calculatedMin = numValue * 0.85;
      const calculatedMax = numValue * 1.15;
      setFilters({
        ...filters,
        min_price: calculatedMin.toString(),
        max_price: calculatedMax.toString(),
      });
    }
  };

  const handleApplyFilters = () => {
    if (priceSearchMode === "smart" && budget && budget > 0) {
      const budgetValue = budget;
      const calculatedMin = Math.floor(budgetValue * 0.85);
      const calculatedMax = Math.ceil(budgetValue * 1.15);
      setFilters((prev) => ({
        ...prev,
        min_price: calculatedMin.toString(),
        max_price: calculatedMax.toString(),
      }));
    }
    loadListings();
    setFiltersOpen(false);
  };

  const loadListings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const timeoutId = setTimeout(() => {
      setLoadError("Request timeout - please refresh");
      setLoading(false);
    }, 10000);

    try {
      let q = supabase
        .from("car_listings")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      let minP: number | undefined;
      let maxP: number | undefined;

      if (priceSearchMode === "smart" && budget && budget > 0) {
        minP = Math.floor(budget * 0.85);
        maxP = Math.ceil(budget * 1.15);
        setFilters((prev) => ({
          ...prev,
          min_price: minP!.toString(),
          max_price: maxP!.toString(),
        }));
      } else {
        minP = filters.min_price ? parseFloat(filters.min_price) : undefined;
        maxP = filters.max_price ? parseFloat(filters.max_price) : undefined;
      }

      const minY = filters.min_year
        ? parseInt(filters.min_year, 10)
        : undefined;
      const maxY = filters.max_year
        ? parseInt(filters.max_year, 10)
        : undefined;
      const maxM = filters.max_mileage
        ? parseInt(filters.max_mileage, 10)
        : undefined;

      if (minP != null && !isNaN(minP)) q = q.gte("price", minP);
      if (maxP != null && !isNaN(maxP)) q = q.lte("price", maxP);
      if (minY != null && !isNaN(minY)) q = q.gte("year", minY);
      if (maxY != null && !isNaN(maxY)) q = q.lte("year", maxY);
      if (maxM != null && !isNaN(maxM)) q = q.lte("mileage", maxM);

      const { data, error } = await q;
      clearTimeout(timeoutId);
      if (error) throw error;
      setListings((data as CarListing[]) ?? []);
    } catch (e) {
      clearTimeout(timeoutId);
      setListings([]);
      const msg = e instanceof Error ? e.message : "Failed to load listings";
      setLoadError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filters, priceSearchMode, budget, toast]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const filtered = useMemo(() => {
    let out = listings;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      out = out.filter(
        (l) =>
          l.title?.toLowerCase().includes(s) ||
          l.make?.toLowerCase().includes(s) ||
          l.model?.toLowerCase().includes(s),
      );
    }
    if (!showSoldCars) out = out.filter((l) => !l.is_sold);
    return out;
  }, [listings, search, showSoldCars]);

  const sortedListings = useMemo(() => {
    const arr = [...filtered];
    if (sortMode === "newest") {
      arr.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } else if (sortMode === "price_asc") {
      arr.sort((a, b) => Number(a.price) - Number(b.price));
    } else {
      arr.sort((a, b) => Number(b.price) - Number(a.price));
    }
    return arr;
  }, [filtered, sortMode]);

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const posted = new Date(date);
    const diffMs = now.getTime() - posted.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return t("postedMinutesAgo", { n: diffMins });
    if (diffHours < 24) return t("postedHoursAgo", { n: diffHours });
    if (diffDays < 30) return t("postedDaysAgo", { n: diffDays });
    return t("postedMonthsAgo", { n: Math.floor(diffDays / 30) });
  };

  const filterInputClass =
    "min-h-[44px] rounded-xl border border-slate-200 bg-white text-[16px] leading-normal text-slate-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-white";

  const filterFields = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <Label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {t("priceRange")}
        </Label>
        <Tabs
          value={priceSearchMode}
          onValueChange={(v) => {
            const newMode = v as "range" | "smart";
            setPriceSearchMode(newMode);
            if (newMode === "range") {
              setBudget(null);
            } else if (!budget) {
              setFilters({ ...filters, min_price: "", max_price: "" });
            }
          }}
          className="mb-3"
        >
          <TabsList className="grid w-full grid-cols-2 rounded-xl border border-slate-200 bg-slate-100/90 dark:border-white/10 dark:bg-white/5">
            <TabsTrigger
              value="range"
              className="min-h-[44px] data-[state=active]:bg-violet-600 data-[state=active]:text-white"
            >
              Range
            </TabsTrigger>
            <TabsTrigger
              value="smart"
              className="flex min-h-[44px] items-center gap-1 data-[state=active]:bg-violet-600 data-[state=active]:text-white"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Smart
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {priceSearchMode === "range" && (
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={t("min")}
              value={filters.min_price}
              onChange={(e) => {
                setFilters({ ...filters, min_price: e.target.value });
                setBudget(null);
              }}
              className={filterInputClass}
            />
            <Input
              type="number"
              placeholder={t("max")}
              value={filters.max_price}
              onChange={(e) => {
                setFilters({ ...filters, max_price: e.target.value });
                setBudget(null);
              }}
              className={filterInputClass}
            />
          </div>
        )}

        {priceSearchMode === "smart" && (
          <div className="space-y-3">
            <Input
              type="number"
              placeholder="Your target budget ($)"
              value={budget || ""}
              onChange={(e) => handleBudgetChange(e.target.value)}
              className={`${filterInputClass} pr-16`}
            />
            <div className="flex flex-wrap gap-2">
              {budgetChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleBudgetChipClick(chip)}
                  className="min-h-[44px] rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 touch-manipulation dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div>
        <Label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {t("yearRange")}
        </Label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder={t("min")}
            value={filters.min_year}
            onChange={(e) =>
              setFilters({ ...filters, min_year: e.target.value })
            }
            className={filterInputClass}
          />
          <Input
            type="number"
            placeholder={t("max")}
            value={filters.max_year}
            onChange={(e) =>
              setFilters({ ...filters, max_year: e.target.value })
            }
            className={filterInputClass}
          />
        </div>
      </div>
      <div>
        <Label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {t("maxMileage")}
        </Label>
        <Input
          type="number"
          placeholder={t("maxMileagePlaceholder")}
          value={filters.max_mileage}
          onChange={(e) =>
            setFilters({ ...filters, max_mileage: e.target.value })
          }
          className={filterInputClass}
        />
      </div>
    </div>
  );

  const filterActions = (
    <div className="mt-5 flex flex-wrap gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setFilters({
            min_price: "",
            max_price: "",
            min_year: "",
            max_year: "",
            max_mileage: "",
          });
          setBudget(null);
          setPriceSearchMode("range");
        }}
        className="min-h-[44px] rounded-xl border-slate-300 bg-transparent dark:border-white/15"
      >
        {t("clearAll")}
      </Button>
      <Button
        type="button"
        onClick={handleApplyFilters}
        className="min-h-[44px] bg-violet-600 hover:bg-violet-500"
      >
        {t("applyFilters")}
      </Button>
    </div>
  );

  return (
    <>
      <div className="relative w-full min-h-0 overflow-x-clip text-slate-900 dark:text-slate-100">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 md:px-8 md:pb-20 md:pt-10">
          <h1 className="mb-6 w-full max-w-full break-words px-0.5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:px-1 md:text-4xl">
            {t("title")}
          </h1>

          {/* Toolbar: mobile stacks search, then sort + filters row (16px text avoids iOS input zoom) */}
          <div className="glass-card mb-6 rounded-2xl p-3 shadow-[0_8px_40px_rgba(0,0,0,0.12)] md:p-4 dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
              <div className="relative min-w-0 flex-1 md:flex-[1_1_auto]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadListings()}
                  placeholder={t("searchPlaceholder")}
                  className="min-h-[44px] rounded-xl border border-slate-200/80 bg-white/90 pl-10 text-[16px] leading-normal text-slate-900 shadow-inner shadow-slate-900/5 placeholder:text-slate-500 focus-visible:border-violet-500/50 focus-visible:ring-2 focus-visible:ring-violet-500/25 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-none dark:placeholder:text-slate-500"
                />
              </div>
              <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:shrink-0 md:gap-3">
                <Select
                  value={sortMode}
                  onValueChange={(v) => setSortMode(v as SortMode)}
                >
                  <SelectTrigger className="min-h-[44px] w-full min-w-0 rounded-xl border-slate-200/80 bg-white/90 text-[16px] dark:border-white/10 dark:bg-white/[0.06] md:min-w-[200px] md:flex-1">
                    <ArrowUpDown className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                    <SelectValue placeholder={t("sortBy")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">{t("sortNewest")}</SelectItem>
                    <SelectItem value="price_asc">
                      {t("sortPriceAsc")}
                    </SelectItem>
                    <SelectItem value="price_desc">
                      {t("sortPriceDesc")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFiltersOpen((o) => !o)}
                  className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl border-slate-200/80 bg-white/80 px-4 hover:bg-white dark:border-white/15 dark:bg-white/[0.06] dark:hover:bg-white/10 md:px-5"
                >
                  <Filter className="mr-2 h-5 w-5 md:inline" />
                  <span className="hidden sm:inline">{t("filters")}</span>
                  <span className="sm:hidden">{t("filters")}</span>
                </Button>
              </div>
            </div>

            {/* Desktop: inline filters panel */}
            <AnimatePresence>
              {filtersOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="hidden overflow-hidden md:block"
                >
                  <div className="mt-4 border-t border-slate-200/60 pt-4 dark:border-white/10">
                    {filterFields}
                    {filterActions}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mb-6 flex min-h-[44px] items-center gap-3">
            <Checkbox
              id="show-sold"
              checked={showSoldCars}
              onCheckedChange={(c) => setShowSoldCars(!!c)}
              className="h-6 w-6 border-slate-300 data-[state=checked]:bg-violet-600 dark:border-white/20"
            />
            <Label
              htmlFor="show-sold"
              className="cursor-pointer text-base font-medium text-slate-600 dark:text-slate-300"
            >
              {t("showSoldCars")}
            </Label>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 xs:gap-4 md:grid-cols-3 md:gap-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </div>
          ) : loadError ? (
            <div className="glass-card rounded-2xl py-16 text-center">
              <p className="mb-4 text-lg text-slate-600 dark:text-slate-400">
                {loadError}
              </p>
              <Button
                onClick={loadListings}
                className="min-h-[44px] bg-violet-600 hover:bg-violet-500"
              >
                {t("retry")}
              </Button>
            </div>
          ) : sortedListings.length === 0 ? (
            <div className="glass-card rounded-2xl border border-dashed border-slate-300/80 px-4 py-16 text-center dark:border-white/15">
              <EmptySearchIllustration className="mx-auto mb-6 h-36 w-48 text-violet-500 dark:text-violet-400" />
              <p className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
                {listings.length === 0
                  ? t("noListings")
                  : t("emptySearchTitle")}
              </p>
              <p className="mb-8 text-slate-600 dark:text-slate-400">
                {listings.length === 0 ? t("postFirst") : t("emptySearchHint")}
              </p>
              {listings.length === 0 ? (
                <Button
                  asChild
                  className="min-h-[44px] bg-violet-600 hover:bg-violet-500"
                >
                  <Link href={`/${locale}/sell`}>{t("postFirst")}</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] border-white/20"
                  onClick={() => {
                    setSearch("");
                    setFilters({
                      min_price: "",
                      max_price: "",
                      min_year: "",
                      max_year: "",
                      max_mileage: "",
                    });
                    setBudget(null);
                  }}
                >
                  {t("clearAll")}
                </Button>
              )}
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                {t("showingRange", {
                  from: 1,
                  to: sortedListings.length,
                  total: sortedListings.length,
                })}
              </p>
              <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 xs:gap-4 md:grid-cols-3 md:gap-5">
                {sortedListings.map((listing) => {
                  const src = firstImageUrl(listing.images);
                  const coverUrl = src ? listingImageUrl(src) : null;
                  const sold = !!listing.is_sold;
                  const href = `/${locale}/buy-sell?id=${encodeURIComponent(String(listing.id))}`;
                  const title =
                    listing.title?.trim() ||
                    `${listing.year} ${listing.make} ${listing.model}`;

                  return (
                    <a
                      key={String(listing.id)}
                      href={href}
                      className="group block min-w-0"
                    >
                      <article className="glass-card flex h-full min-w-0 flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/10 dark:hover:shadow-violet-500/15">
                        <div className="relative h-36 w-full shrink-0 overflow-hidden bg-slate-200 dark:bg-slate-800 xs:h-40 sm:h-48 md:h-52">
                          {coverUrl ? (
                            isVideoUrl(coverUrl) ? (
                              <video
                                src={coverUrl}
                                muted
                                playsInline
                                loop
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <img
                                src={listingImageUrl(coverUrl)}
                                alt=""
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                onError={(e) => {
                                  const el = e.target as HTMLImageElement;
                                  el.src = "/images/cars/default-car.svg";
                                  el.onerror = null;
                                }}
                              />
                            )
                          ) : (
                            <div className="flex h-full items-center justify-center bg-slate-800 text-sm text-slate-500">
                              {t("noImage")}
                            </div>
                          )}
                          <span
                            className={`pointer-events-none absolute left-3 top-3 rounded-lg border text-xs font-semibold ${conditionBadgeClass(listing.condition || "")}`}
                          >
                            {conditionLabel(listing.condition || "")}
                          </span>
                          {sold && (
                            <>
                              <div className="pointer-events-none absolute inset-0 bg-black/50" />
                              <span className="absolute right-3 top-3 rounded-lg border border-white/25 bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm">
                                SOLD
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3">
                          <h3 className="mb-1.5 line-clamp-2 text-base font-bold leading-snug text-slate-900 dark:text-white sm:mb-2 sm:text-lg">
                            {title}
                          </h3>
                          <p className="mb-2 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 sm:mb-3 sm:text-2xl">
                            ${Number(listing.price).toLocaleString()}
                          </p>
                          <div className="mt-auto space-y-2 text-sm text-slate-600 dark:text-slate-400">
                            <div className="flex items-center gap-2">
                              <Gauge className="h-4 w-4 shrink-0" />
                              <span>
                                {Number(listing.mileage).toLocaleString()} km
                              </span>
                            </div>
                            {listing.location && (
                              <div className="flex min-w-0 items-center gap-2">
                                <MapPin className="h-4 w-4 shrink-0" />
                                <span className="truncate">
                                  {String(listing.location).split(",")[0]}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 border-t border-white/5 pt-3 text-xs text-slate-500">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              <span>{formatTimeAgo(listing.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </article>
                    </a>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile filters sheet: outside overflow-x-clip so fixed layer is not clipped; z above bottom nav (90); pb clears tab bar (~60px) */}
      <AnimatePresence>
        {filtersOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close filters"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setFiltersOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-x-0 bottom-0 z-[111] max-h-[88vh] overflow-y-auto overscroll-contain rounded-t-2xl border border-slate-200/60 bg-white/95 p-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90 md:hidden"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {t("filters")}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-[44px] min-w-[44px]"
                  onClick={() => setFiltersOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              {filterFields}
              {filterActions}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
