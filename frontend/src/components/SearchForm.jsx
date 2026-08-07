import AdvancedSearchForm from "./AdvancedSearchForm";
import AiSearchComposer from "./AiSearchComposer";
import CollapsiblePanel from "./CollapsiblePanel";
import RecentSearches from "./RecentSearches";

function SearchForm({
  userName,
  campuses,
  formData,
  status,
  isSavingPreference,
  isSearchingListings,
  isLoadingCampuses,
  campusError,
  validationErrors,
  onFieldChange,
  onRentChange,
  onSubmit,
  onClear,
  onRetryCampuses,
  aiSearchDescription,
  onAiSearchDescriptionChange,
  onAiSearch,
  requestAiFilters,
  recentSearches = [],
  isLoadingRecentSearches = false,
}) {
  const friendlyName = userName?.trim().split(/\s+/)[0] || "there";

  return (
    <div className="ai-dashboard">
      <header className="dashboard-welcome" aria-label="Dashboard welcome">
        <p className="dashboard-welcome-title">Welcome back, {friendlyName}</p>
        <p>Let&apos;s find your ideal student housing in Toronto.</p>
      </header>

      <AiSearchComposer
        description={aiSearchDescription}
        onDescriptionChange={onAiSearchDescriptionChange}
        onSearch={onAiSearch}
        requestFilters={requestAiFilters}
      />

      <div className="dashboard-advanced-search-shell">
        <CollapsiblePanel
          title="Advanced Search"
          defaultExpanded={false}
          className="dashboard-advanced-search"
        >
          <AdvancedSearchForm
            campuses={campuses}
            formData={formData}
            status={status}
            isSavingPreference={isSavingPreference}
            isSearchingListings={isSearchingListings}
            isLoadingCampuses={isLoadingCampuses}
            campusError={campusError}
            validationErrors={validationErrors}
            onFieldChange={onFieldChange}
            onRentChange={onRentChange}
            onSubmit={onSubmit}
            onClear={onClear}
            onRetryCampuses={onRetryCampuses}
          />
        </CollapsiblePanel>
      </div>

      <RecentSearches
        searches={recentSearches}
        isLoading={isLoadingRecentSearches}
      />
    </div>
  );
}

export default SearchForm;
