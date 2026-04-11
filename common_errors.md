# common_errors.md

This document tracks technical hurdles and common errors encountered during the development of the Hotel CMS, specifically during the "Item Inventory System" implementation phase.

---

### 1. 📂 `MODULE_NOT_FOUND` on Render (Legacy Imports)
**Error**: 
`Error: Cannot find module './modules/inventory/routes/inventory.routes'` 
`Require stack: /opt/render/project/src/backend/src/server.js`

**Cause**: 
Renaming a module (e.g., from `inventory` to `item-inventory`) without removing the legacy `require` statement in the main server file (`server.js`). Even if the route is not used in `app.use()`, the `require` statement will crash the process on boot.

**Solution**: 
Scan `server.js` for all `require()` calls and ensure they match the current filesystem structure. Delete any orphaned imports.

---

### 2. 🗄️ SQL Syntax Error: Single vs Double Quotes
**Error**:
`Error: syntax error at or near "RECEIVED"` (during `InventoryService.receivePO`)

**Cause**: 
Using double quotes `"` for string literals in PostgreSQL queries instead of single quotes `'`. Double quotes are reserved for identifier names (table/column names), while single quotes are for string values.

**Example**:
- ❌ `UPDATE table SET status = "RECEIVED"`
- ✅ `UPDATE table SET status = 'RECEIVED'`

**Solution**: 
Strictly use single quotes for string values in all raw SQL queries.

---

### 3. @️⃣ Frontend Import Error: `setCurrency`
**Error**:
`ReferenceError: setCurrency is not defined` in `RoomServices.jsx`

**Cause**:
Destructuring a hook or store without correctly identifying the exported member, or calling a function that was not imported from the store.

**Solution**:
Verify that the function is exported from the store (e.g., `zustand` store) and correctly imported in the component using `{ funcName }` syntax.

---

### 4. 🔗 Access Denied on QR Scan
**Error**:
Guests redirecting to an unauthorized page or receiving 403/404 on scanning a valid QR code.

**Cause**:
Backend endpoints for public guest menus (like `/api/public/room-services/:token`) not returning the necessary metadata (like currency) which causes frontend stores to crash or fail initial loading.

**Solution**:
Ensure public endpoints return all required "Display" metadata (Currency, Hotel Branding) along with the operational data (Menu items).

---

### 5. 📉 Missing Items in Paid Invoices
**Error**:
Service charges not appearing on the "Paid Invoice" after checkout.

**Cause**:
Hardcoded filters like `is_billed = false` in the billing summary service. Once a booking is marked as "PAID", the services are marked as "Billed", so a filter looking for "Unbilled" services will return zero results for a finalized invoice.

**Solution**:
Implement a "Historical mode" for the billing service that ignores the `is_billed` filter when viewing finalized records.

---

### 6. 🖼️ Frontend Blank Page: Icon Mismatch
**Error**: 
`ReferenceError: Tag is not defined` (or similar for other icons)

**Cause**: 
Importing an icon with one name (e.g., `import { Tags } from 'lucide-react'`) but using it with another (e.g., `<Tag />`). This causes a runtime crash during the render phase, leading to a blank screen.

**Solution**: 
Ensure the imported name exactly matches the component name used in the JSX. Use `Ctrl+F` to verify all icon usages have corresponding imports.

---

### 7. 📡 `TypeError: apiMethod is not a function`
**Error**: 
`TypeError: itemInventoryAPI.getPOs is not a function`

**Cause**: 
Calling an API method that was defined in a component but forgotten in the centralized `api.js` service file.

**Solution**: 
Always sync the `api.js` file whenever adding new service calls in components. Double-check all exported API objects for completeness.

---

### 8. 🔄 Infinite Redirect Loop (Role Denied)
**Error**: 
App-wide blank page or redirecting to `/dashboard` immediately. Console says `Access denied for role HOTEL_ADMIN`.

**Cause**: 
The `user.roles` structure has a mismatch. For example, the backend/store might have `"admin"` while the frontend expects `"HOTEL_ADMIN"`.

**Solution**: 
Harden `authStore.js` to map legacy roles and be case-insensitive:
```javascript
const r = typeof role === 'string' ? role : role.role;
const upperR = r.toUpperCase();
if (roleName === 'HOTEL_ADMIN') return upperR === 'HOTEL_ADMIN' || upperR === 'ADMIN';
```

---

### 9. 📡 `ECONNREFUSED` (Database/Backend Offline)
**Error**: 
`Failed to load inventory data` toast or `net::ERR_CONNECTION_REFUSED` in console.

**Cause**: 
The backend server (port 5000) or the PostgreSQL database (port 5432) is not running. 

**Solution**: 
1.  Check if postgres is running: `pg_isready` or check Docker Desktop.
2.  Start the backend: `npm run dev` in the `/backend` folder.
3.  Ensure `.env` coordinates (DB_PORT, DB_HOST) match the actual environment.

---

### 10. ⏹️ Blank Page on Sub-modules
**Error**:
Modules like `Stores` or `Expenses` show a blank main content area.

**Cause**:
1.  **Missing Route**: The route is defined in the Sidebar but missing in `InventoryApp.jsx`.
2.  **Mounting Crash**: Component-level error (e.g., missing API function or undefined object property).

**Solution**:
Verify `InventoryApp.jsx` has all children routes:
```javascript
<Route path="stores" element={<StoreManagement />} />
<Route path="expenses" element={<ExpenseManagement />} />
```
Check console for `is not a function` or `cannot read properties of undefined`.

---

### 11. 📊 DataTable Column Format Mismatch (Blank Tables)
**Error**:
DataTable renders empty rows or shows no data despite API returning valid results. Table headers may also be blank.

**Cause**:
The `DataTable` component expects columns in `{ key, label, render(cellValue, row) }` format, but inventory pages were using `{ header, accessor, render(row) }` format. This caused:
- Column headers to be empty (no `label`)
- Cell values to be `undefined` (no `key` lookup)
- Render functions to receive wrong arguments (cell value instead of full row)

**Solution**:
Always use the DataTable column format:
```javascript
// ✅ Correct
{ key: 'name', label: 'Item Name', render: (val, row) => <span>{row.name}</span> }

// ❌ Wrong
{ header: 'Item Name', accessor: 'name', render: (row) => <span>{row.name}</span> }
```
The DataTable now normalizes both formats automatically, but new code should use the `key/label` format.

---

### 12. 🗃️ Room Inventory Module Deleted When Item Inventory Added
**Error**:
Room Inventory page shows blank or API returns 404 for `/api/inventory/hotel/:id/dashboard`.

**Cause**:
The `backend/src/modules/inventory/` directory (Room Inventory) was accidentally deleted when the `item-inventory` module was created, because both shared a similar name. This removed the room inventory controller, service, and routes.

**Solution**:
The two modules are completely separate and must both exist:
- `modules/inventory/` — Room Inventory (room_inventory table, availability calendar)
- `modules/item-inventory/` — Item Inventory (10 tables, physical supplies)

Both must be registered in `server.js`:
```javascript
app.use('/api/inventory', roomInventoryRoutes);
app.use('/api/item-inventory', itemInventoryRoutes);
```

---

### 13. 🔒 CHECK Constraint Violations on Stock Movements & Breakage
**Error**:
`ERROR: new row for relation "inventory_stock_movements" violates check constraint` or similar for `inventory_breakage_reports`.

**Cause**:
Database CHECK constraints on `movement_type` and breakage `type` columns were too restrictive. The migration hardcoded specific values (e.g., `IN|OUT|TRANSFER|ADJUSTMENT|PO_RECEIVE|BREAKAGE|SALE`) but the application sends values not in that list (e.g., `ADJUSTMENT_OUT`).

**Solution**:
Remove rigid CHECK constraints from these columns. Use `VARCHAR(30)` without CHECK for `movement_type` and `VARCHAR(50)` without CHECK for breakage `type`. The application layer validates values instead.

---

### 14. 🏗️ Missing Database Columns (location, payment_method)
**Error**:
`ERROR: column "location" of relation "inventory_stores" does not exist` (or `payment_method` for expenses).

**Cause**:
The migration SQL or auto-migration code didn't include all columns that the service layer writes to. The service calls `INSERT INTO inventory_stores (..., location)` but the table was created without a `location` column.

**Solution**:
Ensure `database.js` auto-migration and `migration_inventory_failsafe.sql` both include all columns:
- `inventory_stores`: must have `location VARCHAR(255)`
- `inventory_expenses`: must have `payment_method VARCHAR(50)`

---

### 15. 🧮 JavaScript String Concatenation Bugs (`"2" + "2" = "22"`)
**Error**:
Logic validating capacities fails unexpectedly (e.g., `Total guests (22) exceeds maximum occupancy (4)`).

**Cause**:
Variables extracted from frontend API calls, specifically numerical values like `adults` or `children`, arrive natively as Strings under certain conditions or frameworks. When adding them together (`totalGuests = adults + children`), javascript performs a string concatenation rather than an algebraic addition.

**Solution**:
Strictly parse or cast incoming numerical arguments in services before using them in any mathematical operation:
```javascript
let adults = parseInt(params.adults) || 1;
let children = parseInt(params.children) || 0;
```

---

### 16. 🐛 PDF Export Crashes due to Undefined References
**Error**:
Clicking "Download PDF" silently fails or breaks the component render cycle without an obvious console error aside from a missing parameter. 

**Cause**:
Using a destructured variable (like `${currencySymbol}`) inside document generation schemas (like jsPDF) without specifically extracting it from the bound Store/Hook at the top of the component file.
Example of failure:
```javascript
const { formatCurrency } = useCurrencyStore();
// later in code...
const label = `${currencySymbol}100.00`; // Will crash because currencySymbol is undefined
```

**Solution**:
Verify that all variables inside template literal strings used within PDF/external library generation code are correctly exported and destructured from their origin hooks/stores. Do not assume hooks automatically inject environment properties uncalled.
```javascript
// ✅ Correct
const { formatCurrency, currencySymbol } = useCurrencyStore();
```
---

### 17. 🚷 Bulk Booking Children Cluttering Dashboard
**Error**: 
Wait, child bookings of a bulk group appear in the main "Bookings" list, confusing the management of individual vs group guests.

**Cause**: 
The standard `getBookingsByHotel` query returned all rows from the `bookings` table. Since bulk bookings create child records in the same table, they were inadvertently included.

**Solution**: 
Append `AND b.bulk_booking_id IS NULL` to all primary dashboard and front-desk booking queries. This ensures only standard, independent reservations are visible in the regular menu, while group members are managed exclusively through the "Bulk Bookings" module.

---

### 18. 🏨 Group Check-in Room Assignment (Missing Selection)
**Error**: 
Hotels assign rooms to a group, but the individual members don't show specific room numbers on their own (hidden) records until manually updated.

**Cause**: 
Bulk booking creation specifies categories (e.g., 5 Deluxe) but doesn't assign specific numbers (e.g., Room 101, 102) because physical rooms might change by the check-in date.

**Solution**: 
Implement a "Group Check-in" bridge that allows staff to map each reserved spot to a physical `room_id` in a single action. The service must then update the child `bookings`, `booking_rooms`, and the `rooms.status` simultaneously.

---

### 19. 🔄 Bulk Booking Status Update Argument Mismatch
**Error**: 
`invalid input syntax for type uuid: "undefined"` when calling `bulkBookingAPI.updateStatus`.

**Cause**: 
The `bulkBookingAPI.updateStatus` function in `api.js` expects 4 arguments: `(id, status, room_assignments, hotelId)`. If called with only 3 arguments (e.g., `(id, status, hotelId)` during a cancellation), `hotelId` is treated as `room_assignments`, and the actual `hotelId` parameter in the URL remains `undefined`.

**Resolution**: 
Always pass `null` or an empty array for `room_assignments` when updating group status from a list view where specific room mapping isn't required.
```javascript
// ❌ Wrong 
bulkBookingAPI.updateStatus(id, 'CANCELLED', hotelId); 

// ✅ Correct
bulkBookingAPI.updateStatus(id, 'CANCELLED', null, hotelId);
```

---

## 20. 🧩 Missing Lucide Icon Import Crash
**Error**: Blank screen (React runtime crash) when opening a specific modal or page. Console shows `ReferenceError: IconName is not defined`.

**Cause**: Using a new Lucide icon component in the JSX (e.g., `<Tag />`) without adding it to the destructured `lucide-react` import statement at the top of the file.

**Resolution**: Always verify all icons used in a component are present in the import list.
```javascript
// ✅ Correct
import { Plus, Users, Tag } from 'lucide-react';
```

---

## 21. 🔄 Data Stale-ness After Modal Update
**Error**: Updating complex records (like Bulk Billing) in a modal doesn't reflect changes immediately, or crashes because global state is out of sync.

**Cause**: Attempting to refresh data by re-calling a "List All" API instead of a specific "Get By ID" API for the active record. List APIs might have cached results or paginated delays.

**Resolution**: Always implement and use a `getById` endpoint to refetch the source-of-truth for the specific record being managed in a modal, ensuring the modal state is updated from the server's response.

---

## 22. 🌐 Localization Key Mismatch (Raw Keys Displayed)
**Error**: UI displays raw strings like `bulk_bookings.modals.invoice.title` instead of the actual translated text.

**Cause**: The path passed to the `t()` function does not exactly match the hierarchy in the `en.json` (or other locale) file. Common mistakes include inconsistent nesting (e.g., including or omitting `.modals.`).

**Resolution**: Audit the `i18next` key path against the JSON file structure. Keep naming conventions consistent across components (e.g., all invoice keys under `bulk_bookings.invoice`).

---

## 23. 🚫 Invalid Status Transitions (Business Logic)
**Error**: Cancelled bookings still showing charges, or check-in allowed for cancelled bookings.

**Cause**: Lack of backend guards on status transitions. UI might hide buttons, but API endpoints remain vulnerable.

**Resolution**: 
1. Implement backend guard: `if (current.status === 'CHECKED_IN') throw Error('Cannot cancel');`
2. Implement logic-aware billing: If status is `CANCELLED`, the billing engine (e.g., `getCombinedInvoice`) must return 0 for all balance-bearing fields.
3. UI-level disables: Use `disabled={status === 'CHECKED_IN'}` on action buttons.

---

## 24. 🧩 Group Check-in Guest-to-Room Mapping
**Error**: Guests incorrectly mapped to rooms in a bulk check-in, or guest details lost for specific child bookings.

**Cause**: Bulk bookings are composed of multiple child bookings. Collecting a flat list of guests without a way to map them to specific room slots leads to data ambiguity.

**Resolution**: 
1. Use a multi-step modal.
2. Step 1: Finalize room assignments and store the resulting room IDs for each child booking.
3. Step 2: Render guest forms and provide a mapping (e.g., `room_idx`) so each guest can be associated with one of the assigned rooms.
4. Backend: Loop through guest details and use the mapping to retrieve the correct `child_booking_id` for insertion into the `booking_guests` table.
