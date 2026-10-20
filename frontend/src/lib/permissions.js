// Daftar semua izin - GLOBAL
export const PERMISSIONS = {
  // Produk
  PRODUCT_VIEW: 'product.view',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_EDIT: 'product.edit',
  PRODUCT_DELETE: 'product.delete',
  PRICE_MODAL_EDIT: 'price.modal_edit', // harga modal
  PRICE_JUAL_EDIT: 'price.jual_edit',

  // Kasir
  CASHIER_DISCOUNT: 'cashier.discount',
  CASHIER_DELETE_ITEM: 'cashier.delete_item', // hapus item + alasan
  CASHIER_VOID: 'cashier.void',

  // Layout
  CATEGORY_REORDER: 'layout.category_reorder',
  QUICK_BUTTON_EDIT: 'layout.quick_button',
};

// Role default - SESUAI DB role_permissions
export const ROLE_DEFAULTS = {
  owner: Object.values(PERMISSIONS), // semua
  manager: Object.values(PERMISSIONS), // semua
  
  cashier: [
    PERMISSIONS.PRODUCT_VIEW, 
    PERMISSIONS.CASHIER_DISCOUNT, 
    PERMISSIONS.CASHIER_DELETE_ITEM,
    PERMISSIONS.CASHIER_VOID,
    PERMISSIONS.CATEGORY_REORDER
  ],
  
  warehouse: [
    PERMISSIONS.PRODUCT_VIEW, 
    PERMISSIONS.PRODUCT_CREATE, 
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRICE_JUAL_EDIT
  ],
  
  admin_toko: [
    PERMISSIONS.PRODUCT_VIEW, PERMISSIONS.PRODUCT_CREATE, PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRICE_JUAL_EDIT, PERMISSIONS.CASHIER_DISCOUNT, PERMISSIONS.CASHIER_DELETE_ITEM,
    PERMISSIONS.CATEGORY_REORDER, PERMISSIONS.QUICK_BUTTON_EDIT
  ],
};
