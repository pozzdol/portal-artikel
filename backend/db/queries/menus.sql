-- name: ListMenus :many
SELECT * FROM menus ORDER BY id;

-- name: GetMenuByCode :one
SELECT * FROM menus WHERE code = $1;

-- name: ListMenuItems :many
SELECT * FROM menu_items
WHERE menu_id = $1
ORDER BY parent_id NULLS FIRST, sort_order, id;

-- name: ListAllMenuItems :many
SELECT * FROM menu_items
ORDER BY menu_id, parent_id NULLS FIRST, sort_order, id;

-- name: DeleteMenuItems :exec
DELETE FROM menu_items WHERE menu_id = $1;

-- name: CreateMenuItem :one
INSERT INTO menu_items (menu_id, parent_id, label, link_type, link_target, open_new_tab, sort_order, is_active)
VALUES (sqlc.arg(menu_id), sqlc.narg(parent_id), sqlc.arg(label), sqlc.arg(link_type), sqlc.arg(link_target),
        sqlc.arg(open_new_tab), sqlc.arg(sort_order), sqlc.arg(is_active))
RETURNING id;
