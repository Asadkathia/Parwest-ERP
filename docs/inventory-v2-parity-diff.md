# Inventory V2 Parity Diff Report

Generated: 2026-03-17T00:56:49.828Z

## Summary
- Legacy units: 19
- V2 tracked units: 0
- Unit drift: 19 (100%)
- Legacy issued: 1
- V2 issued: 0
- Issued drift: 1 (100%)

## Suspicious Contributors
- Suspicious balance rows: 0
- Suspicious tracked units: 0
- Suspicious issued units: 0
- Adjusted tracked units (if suspicious removed): 0
- Adjusted unit drift: 19 (100%)

## Candidate Cleanup SQL
Review before execution. Intended for non-production strict-test data cleanup.

```sql
BEGIN;
DELETE FROM "StoreInventoryMovement" m USING "StoreInventoryProduct" p WHERE m."productId" = p.id AND (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');
DELETE FROM "StoreInventoryAssignment" a USING "StoreInventoryProduct" p WHERE a."productId" = p.id AND (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');
DELETE FROM "StoreInventoryDemandResponseLine" drl USING "StoreInventoryProduct" p WHERE drl."productId" = p.id AND (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');
DELETE FROM "StoreInventoryDemandLine" dl USING "StoreInventoryProduct" p WHERE dl."productId" = p.id AND (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');
DELETE FROM "StoreInventoryAdjustmentLine" al USING "StoreInventoryProduct" p WHERE al."productId" = p.id AND (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');
DELETE FROM "StoreInventoryPurchaseLine" pl USING "StoreInventoryProduct" p WHERE pl."productId" = p.id AND (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');
DELETE FROM "StoreInventoryBalance" b USING "StoreInventoryProduct" p WHERE b."productId" = p.id AND (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');
DELETE FROM "StoreInventoryProduct" p WHERE (p.sku ILIKE 'INV2-SKU-%' OR p.name ILIKE 'Inventory V2 Product %' OR p.sku ILIKE 'IMPORT-%' OR p.name ILIKE 'Imported Inventory Product%');
DELETE FROM "Store" s WHERE (s.code ILIKE 'INV2-%' OR s.name ILIKE 'Inventory V2 %');
COMMIT;
```

