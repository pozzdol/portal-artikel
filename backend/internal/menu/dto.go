package menu

// AdminItem is one menu item as shown in /admin/menus: the raw stored fields
// plus a resolved href (empty when the target no longer exists; the admin UI
// still shows the item so it can be fixed or removed).
type AdminItem struct {
	ID         int64       `json:"id"`
	Label      string      `json:"label"`
	LinkType   string      `json:"link_type"`
	LinkTarget string      `json:"link_target"`
	Href       string      `json:"href"`
	OpenNewTab bool        `json:"open_new_tab"`
	IsActive   bool        `json:"is_active"`
	SortOrder  int32       `json:"sort_order"`
	Children   []AdminItem `json:"children"`
}

// MenuWithItems is one menu (header, footer_*) with its resolved item tree.
type MenuWithItems struct {
	Code  string      `json:"code"`
	Name  string      `json:"name"`
	Items []AdminItem `json:"items"`
}

// PublicItem is the public, frontend-facing shape: inactive items and items
// whose target no longer resolves are dropped entirely (see ResolvePublic).
type PublicItem struct {
	ID         int64        `json:"id"`
	Label      string       `json:"label"`
	Href       string       `json:"href"`
	OpenNewTab bool         `json:"open_new_tab"`
	Children   []PublicItem `json:"children,omitempty"`
}

// ItemInput is one node of the tree sent to PUT /menus/{code}/items. Depth is
// capped at 2 levels: Children may not themselves have children (checked in
// Service.ReplaceItems, not by the validator).
type ItemInput struct {
	Label      string      `json:"label" validate:"required,max=80"`
	LinkType   string      `json:"link_type" validate:"required,oneof=url category page route anchor"`
	LinkTarget string      `json:"link_target" validate:"required,max=300"`
	OpenNewTab bool        `json:"open_new_tab"`
	IsActive   bool        `json:"is_active"`
	Children   []ItemInput `json:"children,omitempty" validate:"dive"`
}

// ItemsInput is the PUT /menus/{code}/items body: the whole tree, replacing
// every existing item of that menu in one transaction.
type ItemsInput struct {
	Items []ItemInput `json:"items" validate:"dive"`
}
