const fs = require('fs');

// Create constants file
const constants = `import { ProductItem } from "@/types";

export const INITIAL_PRODUCTS: ProductItem[] = [
  { id: "p1", name: "Cám lợn (heo)", price: 380000, allow25kg: true, allow50kg: true, stock25kg: 25, stock50kg: 40, minStockAlert: 5 },
  { id: "p2", name: "Cám gà / vịt", price: 350000, allow25kg: true, allow50kg: true, stock25kg: 18, stock50kg: 32, minStockAlert: 5 },
  { id: "p3", name: "Cám bò / dê", price: 290000, allow25kg: true, allow50kg: true, stock25kg: 10, stock50kg: 20, minStockAlert: 5 },
  { id: "p4", name: "Gạo ST25", price: 420000, allow25kg: true, allow50kg: true, stock25kg: 30, stock50kg: 50, minStockAlert: 5 },
  { id: "p5", name: "Gạo Đài Thơm", price: 360000, allow25kg: true, allow50kg: true, stock25kg: 20, stock50kg: 35, minStockAlert: 5 },
  { id: "p6", name: "Gạo Bắc Hương", price: 340000, allow25kg: true, allow50kg: true, stock25kg: 15, stock50kg: 25, minStockAlert: 5 },
  { id: "p7", name: "Phân bón NPK", price: 450000, allow25kg: true, allow50kg: true, stock25kg: 12, stock50kg: 28, minStockAlert: 5 },
  { id: "p8", name: "Đạm Ure", price: 390000, allow25kg: true, allow50kg: true, stock25kg: 14, stock50kg: 22, minStockAlert: 5 },
  { id: "p9", name: "Phân Lân / Kali", price: 310000, allow25kg: true, allow50kg: true, stock25kg: 8, stock50kg: 18, minStockAlert: 5 },
  { id: "p10", name: "Ngô hạt / Bột ngô", price: 280000, allow25kg: true, allow50kg: true, stock25kg: 16, stock50kg: 30, minStockAlert: 5 },
  { id: "p11", name: "Đường cát trắng", price: 520000, allow25kg: true, allow50kg: true, stock25kg: 10, stock50kg: 15, minStockAlert: 5 },
];
`;

fs.mkdirSync('src/constants', { recursive: true });
fs.writeFileSync('src/constants/products.ts', constants);

// Update SalesForm.tsx to import from constants
let sf = fs.readFileSync('src/components/SalesForm.tsx', 'utf-8');
// Replace the local INITIAL_PRODUCTS declaration with import
sf = sf.replace(
  'import { useToast } from "@/components/Toast";\nimport React',
  'import { useToast } from "@/components/Toast";\nimport { INITIAL_PRODUCTS } from "@/constants/products";\nimport React'
);
// Remove the local INITIAL_PRODUCTS array (from const INITIAL_PRODUCTS to the line before calculateBagPrice)
const localDeclStart = sf.indexOf('\nconst INITIAL_PRODUCTS: ProductItem[] = [');
const localDeclEnd = sf.indexOf('];\n', localDeclStart) + 3;
sf = sf.slice(0, localDeclStart) + '\n' + sf.slice(localDeclEnd);
fs.writeFileSync('src/components/SalesForm.tsx', sf);

// Update page.tsx to import from constants
let pg = fs.readFileSync('src/app/page.tsx', 'utf-8');
if (!pg.includes('INITIAL_PRODUCTS')) {
  console.log('page.tsx does not use INITIAL_PRODUCTS by name, checking...');
}
// Find and check if page.tsx has its own declaration
const pgDeclStart = pg.indexOf('\nconst INITIAL_PRODUCTS');
if (pgDeclStart !== -1) {
  const pgDeclEnd = pg.indexOf('];\n', pgDeclStart) + 3;
  pg = 'import { INITIAL_PRODUCTS } from "@/constants/products";\n' + pg.slice(0, pgDeclStart) + '\n' + pg.slice(pgDeclEnd);
  fs.writeFileSync('src/app/page.tsx', pg);
  console.log('Replaced INITIAL_PRODUCTS in page.tsx');
} else {
  console.log('INITIAL_PRODUCTS not found in page.tsx or already removed');
}

console.log('constants/products.ts created, SalesForm.tsx updated');
