namespace sunsteel.api.Common.Security;

/// <summary>
/// Permission codes, matching the Code column of the Permissions table (migration 003).
/// Constants rather than strings at call sites: a typo in [Authorize(Policy = ...)]
/// compiles fine and silently locks everyone out of a screen.
/// </summary>
public static class Perm
{
    public const string LeadManage = "lead.manage";
    public const string CatalogManage = "catalog.manage";
    public const string StockManage = "stock.manage";
    public const string MediaManage = "media.manage";
    public const string CmsManage = "cms.manage";
    public const string ThemeManage = "theme.manage";
    public const string SettingsManage = "settings.manage";
    public const string UserManage = "user.manage";
    /// <summary>Change GST rates, HSN codes, the MS pipe schedule, payment terms and bank details (migration 021).</summary>
    public const string QuoteData = "quote.data";

    /// <summary>Every code, so one authorization policy is registered per permission.</summary>
    public static readonly string[] All =
    [
        LeadManage, CatalogManage, StockManage, MediaManage, CmsManage, ThemeManage, SettingsManage, UserManage, QuoteData,
    ];

    /// <summary>The JWT claim type that carries these codes.</summary>
    public const string ClaimType = "perm";
}
