# SKILLS.md — Hotel CMS Development Skills Reference

> Codified patterns, recipes, and step-by-step guides for common development tasks in this codebase.

---

## Table of Contents

- [Skill 1: Add a New Backend Module](#skill-1-add-a-new-backend-module)
- [Skill 2: Add a New Frontend Page](#skill-2-add-a-new-frontend-page)
- [Skill 3: Add a New Database Table](#skill-3-add-a-new-database-table)
- [Skill 4: Add a New API Endpoint to an Existing Module](#skill-4-add-a-new-api-endpoint-to-an-existing-module)
- [Skill 5: Add a New Permission / RBAC Gate](#skill-5-add-a-new-permission--rbac-gate)
- [Skill 6: Add a New Zustand Store](#skill-6-add-a-new-zustand-store)
- [Skill 7: Write a Service with Transactions & Audit Logging](#skill-7-write-a-service-with-transactions--audit-logging)
- [Skill 8: Add a DataTable Page](#skill-8-add-a-datatable-page)
- [Skill 9: Add a Sidebar Navigation Item](#skill-9-add-a-sidebar-navigation-item)
- [Skill 10: Database Migration (Add Column to Existing Table)](#skill-10-database-migration-add-column-to-existing-table)
- [Skill 11: Debug Blank Screen / Runtime Crash](#skill-11-debug-blank-screen--runtime-crash)
- [Skill 12: Add a Public (Unauthenticated) Endpoint](#skill-12-add-a-public-unauthenticated-endpoint)
- [Skill 13: Booking Status Transition Guard](#skill-13-booking-status-transition-guard)
- [Skill 14: Add Hotel-Scoped Feature with Quota Enforcement](#skill-14-add-hotel-scoped-feature-with-quota-enforcement)

---

## Skill 1: Add a New Backend Module

**When**: You need a completely new domain feature (e.g., "Housekeeping", "Maintenance Requests").

### Steps

1. **Create module directory structure:**
   ```
   backend/src/modules/<module-name>/
   ├── controllers/<name>.controller.js
   ├── services/<name>.service.js
   └── routes/<name>.routes.js
   ```

2. **Service** (`services/<name>.service.js`):
   ```javascript
   const db = require('../../../config/database');

   class ModuleNameService {
     async create(data, userId) {
       const client = await db.pool.connect();
       try {
         await client.query('BEGIN');
         const result = await client.query(
           `INSERT INTO module_table (hotel_id, name, ...) VALUES ($1, $2, ...) RETURNING *`,
           [data.hotel_id, data.name]
         );
         // Audit log
         await this.createAuditLog({
           hotel_id: data.hotel_id,
           user_id: userId,
           action: 'CREATE_MODULE',
           entity_type: 'MODULE',
           entity_id: result.rows[0].id,
           new_data: result.rows[0]
         }, client);
         await client.query('COMMIT');
         return result.rows[0];
       } catch (error) {
         await client.query('ROLLBACK');
         throw error;
       } finally {
         client.release();
       }
     }

     async createAuditLog(logData, client) {
       await client.query(
         `INSERT INTO audit_logs (hotel_id, user_id, action, entity_type, entity_id, old_data, new_data) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
         [logData.hotel_id, logData.user_id, logData.action, logData.entity_type, logData.entity_id,
          JSON.stringify(logData.old_data || null), JSON.stringify(logData.new_data || null)]
       );
     }
   }

   module.exports = new ModuleNameService();
   ```

3. **Controller** (`controllers/<name>.controller.js`):
   ```javascript
   const moduleService = require('../services/<name>.service');

   class ModuleNameController {
     create = async (req, res) => {
       try {
         const result = await moduleService.create(req.body, req.user.id);
         res.status(201).json(result);
       } catch (error) {
         console.error('Create error:', error);
         res.status(500).json({ error: error.message });
       }
     };
   }

   module.exports = new ModuleNameController();
   ```
   > ⚠️ Use **arrow functions** for class methods (or explicit `.bind()`) to preserve `this` context in Express routes.

4. **Routes** (`routes/<name>.routes.js`):
   ```javascript
   const router = require('express').Router();
   const authMiddleware = require('../../../middleware/auth.middleware');
   const { requirePermission } = require('../../../middleware/rbac.middleware');
   const controller = require('../controllers/<name>.controller');

   router.post('/', authMiddleware, requirePermission('MODULE_CREATE'), controller.create);
   router.get('/hotel/:hotelId', authMiddleware, requirePermission('MODULE_VIEW'), controller.getByHotel);

   module.exports = router;
   ```

5. **Register in `server.js`**:
   ```javascript
   const moduleRoutes = require('./modules/<module-name>/routes/<name>.routes');
   app.use('/api/<module-path>', moduleRoutes);
   ```

6. **Add auto-migration** in `database.js` `ensureMigrations()` — see [Skill 3](#skill-3-add-a-new-database-table).

7. **Add frontend API client** in `frontend/src/services/api.js`:
   ```javascript
   export const moduleAPI = {
     getByHotel: (hotelId) => api.get(`/<module-path>/hotel/${hotelId}`),
     create: (data) => api.post('/<module-path>', data),
   };
   ```

---

## Skill 2: Add a New Frontend Page

**When**: You need a new UI page under an existing role group.

### Steps

1. **Create the page component** in `frontend/src/pages/<RoleGroup>/<PageName>.jsx`:
   ```jsx
   import React, { useState, useEffect } from 'react';
   import { useAuthStore } from '../../store/authStore';
   import { moduleAPI } from '../../services/api';
   import toast from 'react-hot-toast';
   import { Plus, Edit, Trash2 } from 'lucide-react';  // ← Always import all used icons
   import DataTable from '../../components/DataTable';
   import Modal from '../../components/Modal';

   export default function PageName() {
     const { getHotelId } = useAuthStore();
     const hotelId = getHotelId();
     const [data, setData] = useState([]);
     const [loading, setLoading] = useState(true);

     useEffect(() => {
       if (hotelId) loadData();
     }, [hotelId]);

     const loadData = async () => {
       try {
         setLoading(true);
         const result = await moduleAPI.getByHotel(hotelId);
         setData(result.data || result);
       } catch (err) {
         toast.error('Failed to load data');
       } finally {
         setLoading(false);
       }
     };

     const columns = [
       { key: 'name', label: 'Name' },
       { key: 'status', label: 'Status' },
       {
         key: 'actions', label: 'Actions',
         render: (val, row) => (
           <div className="flex gap-2">
             <button onClick={() => handleEdit(row)}><Edit size={16} /></button>
             <button onClick={() => handleDelete(row.id)}><Trash2 size={16} /></button>
           </div>
         )
       },
     ];

     return (
       <div className="p-6">
         <div className="flex justify-between items-center mb-6">
           <h1 className="text-2xl font-bold">Page Title</h1>
           <button className="btn btn-primary flex items-center gap-2">
             <Plus size={20} /> Add New
           </button>
         </div>
         <DataTable data={data} columns={columns} loading={loading} />
       </div>
     );
   }
   ```

2. **Register the route** in `App.jsx`:
   ```jsx
   import PageName from './pages/HotelAdmin/PageName';
   // Inside the <Route path="/hotel/*"> block:
   <Route path="page-path" element={<PageName />} />
   ```

3. **Add sidebar item** — see [Skill 9](#skill-9-add-a-sidebar-navigation-item).

---

## Skill 3: Add a New Database Table

**When**: A new feature requires persistent storage.

### Steps

1. **Add to `schema.sql`** (canonical schema reference):
   ```sql
   CREATE TABLE IF NOT EXISTS new_table (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
     name VARCHAR(255) NOT NULL,
     status VARCHAR(20) DEFAULT 'ACTIVE',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **Add auto-migration** in `backend/src/config/database.js` → `ensureMigrations()`:
   ```javascript
   // Inside ensureMigrations(), after existing migrations:
   await client.query(`
     CREATE TABLE IF NOT EXISTS new_table (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
       name VARCHAR(255) NOT NULL,
       status VARCHAR(20) DEFAULT 'ACTIVE',
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )
   `);
   ```

> ⚠️ **Critical**: Both `schema.sql` AND `database.js` must have the table definition. `schema.sql` runs during initial setup; `database.js` ensures it exists on every boot (Render/Docker may not re-run schema.sql).

### Rules
- Always use `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- Always include `hotel_id` FK for hotel-scoped tables
- Always add `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- Use `ON DELETE CASCADE` for child tables
- No rigid `CHECK` constraints on status/type fields — validate in the application layer instead

---

## Skill 4: Add a New API Endpoint to an Existing Module

**When**: Extending an existing module with new functionality.

### Steps

1. **Add the service method** in `services/<name>.service.js`
2. **Add the controller method** in `controllers/<name>.controller.js` (use arrow function!)
3. **Add the route** in `routes/<name>.routes.js` with appropriate middleware
4. **Add the API client method** in `frontend/src/services/api.js` in the correct exported object

### Example — Adding a "getStats" endpoint to the Room module:

```javascript
// room.service.js
async getRoomStats(hotelId) {
  const result = await db.query(
    `SELECT status, COUNT(*) as count FROM rooms WHERE hotel_id = $1 GROUP BY status`,
    [hotelId]
  );
  return result.rows;
}

// room.controller.js
getStats = async (req, res) => {
  try {
    const stats = await roomService.getRoomStats(req.params.hotelId);
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// room.routes.js
router.get('/stats/hotel/:hotelId', authMiddleware, requirePermission('ROOM_VIEW'), controller.getStats);

// api.js (frontend)
export const roomAPI = {
  // ... existing methods
  getStats: (hotelId) => api.get(`/rooms/stats/hotel/${hotelId}`),
};
```

> ⚠️ Always sync `api.js` — calling a method that doesn't exist gives `TypeError: roomAPI.getStats is not a function` (common error #7).

---

## Skill 5: Add a New Permission / RBAC Gate

**When**: New features require access control.

### Steps

1. **Seed the permission** in `database.js` `ensureMigrations()`:
   ```javascript
   const missingPerms = [
     { key: 'MODULE_CREATE', description: 'Create module items', module: 'MODULE' },
     { key: 'MODULE_VIEW', description: 'View module items', module: 'MODULE' },
   ];
   for (const perm of missingPerms) {
     await client.query(
       `INSERT INTO permissions (key, description, module) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`,
       [perm.key, perm.description, perm.module]
     );
   }
   ```

2. **Also add to `schema.sql`** in the permissions INSERT block for fresh installs.

3. **Assign to roles** (in `database.js`):
   ```javascript
   // Auto-assign to HOTEL_ADMIN via role_permissions
   for (const permKey of ['MODULE_CREATE', 'MODULE_VIEW']) {
     await client.query(`
       INSERT INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r, permissions p
       WHERE r.name = 'HOTEL_ADMIN' AND p.key = $1
       ON CONFLICT (role_id, permission_id) DO NOTHING
     `, [permKey]);
   }
   ```

4. **Use in route middleware**:
   ```javascript
   router.get('/', authMiddleware, requirePermission('MODULE_VIEW'), controller.list);
   ```

5. **Frontend permission check** (optional, for conditional UI):
   ```javascript
   const { hasPermission } = useAuthStore();
   {hasPermission('MODULE_CREATE') && <button>Create</button>}
   ```

---

## Skill 6: Add a New Zustand Store

**When**: You need shared client-side state beyond auth or currency.

### Template

```javascript
// frontend/src/store/newStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useNewStore = create(
  persist(
    (set, get) => ({
      items: [],
      selectedId: null,

      setItems: (items) => set({ items }),
      selectItem: (id) => set({ selectedId: id }),
      
      getSelected: () => {
        const { items, selectedId } = get();
        return items.find(i => i.id === selectedId);
      },

      reset: () => set({ items: [], selectedId: null }),
    }),
    {
      name: 'new-store-storage',
      partialize: (state) => ({
        selectedId: state.selectedId,
        // Only persist what's needed — don't persist large datasets
      }),
    }
  )
);
```

### Rules
- Use `persist` middleware for data that should survive page refreshes
- Use `partialize` to limit what's written to `localStorage`
- Always destructure exactly the values you use: `const { items, setItems } = useNewStore()`

---

## Skill 7: Write a Service with Transactions & Audit Logging

**When**: Any mutation that touches multiple tables or requires an audit trail.

### Template

```javascript
async performAction(data, userId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get old data (for audit trail)
    const oldResult = await client.query('SELECT * FROM table WHERE id = $1', [data.id]);
    if (oldResult.rows.length === 0) throw new Error('Record not found');
    const oldData = oldResult.rows[0];

    // 2. Perform mutation
    const result = await client.query(
      `UPDATE table SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [data.name, data.id]
    );

    // 3. Related mutations (e.g., update status history)
    await client.query(
      `INSERT INTO table_history (table_id, from_status, to_status, changed_by) VALUES ($1, $2, $3, $4)`,
      [data.id, oldData.status, data.status, userId]
    );

    // 4. Audit log
    await this.createAuditLog({
      hotel_id: data.hotel_id,
      user_id: userId,
      action: 'UPDATE_TABLE',
      entity_type: 'TABLE',
      entity_id: data.id,
      old_data: oldData,
      new_data: result.rows[0]
    }, client);

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Rules
- **Always** use `BEGIN` / `COMMIT` / `ROLLBACK`
- **Always** release the client in `finally`
- **Always** log the mutation in `audit_logs`
- **Always** capture old data before mutation for the audit trail
- Parse numeric inputs: `parseInt(data.quantity) || 0` — incoming values may be strings

---

## Skill 8: Add a DataTable Page

**When**: You need a list view with sorting, pagination, and actions.

### Column Format (MANDATORY)

```javascript
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status', render: (val, row) => (
    <span className={`px-2 py-1 rounded text-xs ${val === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
      {val}
    </span>
  )},
  { key: 'created_at', label: 'Created', render: (val) => new Date(val).toLocaleDateString() },
  { key: 'actions', label: 'Actions', render: (val, row) => (
    <div className="flex gap-2">
      <button onClick={() => openEdit(row)}><Edit size={16} /></button>
      <button onClick={() => confirmDelete(row.id)}><Trash2 size={16} /></button>
    </div>
  )},
];
```

### Rules
- `key` must match the property name in the data objects
- `render` function receives `(cellValue, fullRow)` — NOT just `(row)`
- Import **all** icon components used in the render functions

---

## Skill 9: Add a Sidebar Navigation Item

**When**: A new page needs to appear in the navigation menu.

### Steps

1. Open `frontend/src/components/Sidebar.jsx`
2. Find the role-specific menu array (search for `SUPER_ADMIN`, `HOTEL_ADMIN`, or `STAFF`)
3. Add the menu item:
   ```javascript
   { label: 'New Feature', icon: IconComponent, path: '/hotel/new-feature' },
   ```

4. For **submenu items** (like Item Inventory), use the `openMenus` state:
   ```javascript
   {
     label: 'Parent Menu',
     icon: FolderIcon,
     submenu: [
       { label: 'Child 1', path: '/hotel/parent/child-1' },
       { label: 'Child 2', path: '/hotel/parent/child-2' },
     ]
   }
   ```

5. Import any new Lucide icons at the top of the file.

---

## Skill 10: Database Migration (Add Column to Existing Table)

**When**: You need to add a column to an existing production table.

### Steps

1. **Add to `database.js` `ensureMigrations()`** using idempotent migration:
   ```javascript
   await client.query('ALTER TABLE existing_table ADD COLUMN IF NOT EXISTS new_column VARCHAR(255)');
   ```

2. **Also update `schema.sql`** so fresh installs have the column.

3. **For complex migrations** (with data backfill):
   ```javascript
   const colCheck = await client.query(`
     SELECT COLUMN_NAME FROM information_schema.columns 
     WHERE table_name = 'existing_table' AND column_name = 'new_column'
   `);
   if (colCheck.rows.length === 0) {
     console.log('🛠️ Altering existing_table: adding new_column');
     await client.query('ALTER TABLE existing_table ADD COLUMN new_column VARCHAR(255)');
     // Optional: backfill data
     await client.query("UPDATE existing_table SET new_column = 'default_value' WHERE new_column IS NULL");
     console.log('✅ Migration applied successfully');
   }
   ```

### Rules
- Always use `ADD COLUMN IF NOT EXISTS` or check `information_schema.columns` first
- Never drop columns in auto-migration — use manual migration scripts for destructive changes
- Log migrations with emoji prefixes: `🛠️` for altering, `📦` for creating, `✅` for success

---

## Skill 11: Debug Blank Screen / Runtime Crash

**When**: The frontend renders a white page with no visible UI.

### Checklist

1. **Open browser Console (F12)** — look for:
   - `ReferenceError: IconName is not defined` → Missing Lucide import ([Skill 8](#skill-8-add-a-datatable-page))
   - `TypeError: xxxAPI.method is not a function` → Method missing from `api.js`
   - `Cannot read properties of undefined` → Data loaded before API returns (add loading guards)
   - `Access denied for role HOTEL_ADMIN` → Role name mismatch in `authStore.hasRole()`

2. **Check for import mismatches**:
   ```bash
   grep -rn "import.*from 'lucide-react'" frontend/src/pages/<file>.jsx
   # Verify every <IconName /> in JSX has a matching import
   ```

3. **Check for missing route**:
   - Verify the route exists in `App.jsx`
   - Verify it's wrapped in the correct `<ProtectedRoute role="...">`

4. **Check for sub-router mounting** (InventoryApp pattern):
   - If using nested routes, ensure `<Route path="parent/*" element={<ParentApp />} />`
   - Inside `ParentApp`, ensure all child `<Route path="child" />` entries exist

---

## Skill 12: Add a Public (Unauthenticated) Endpoint

**When**: Guests or external systems need access without logging in.

### Steps

1. Add the route in `modules/public/routes/public.routes.js` (NO `authMiddleware`):
   ```javascript
   router.get('/new-endpoint/:param', controller.publicMethod);
   ```

2. Ensure the public endpoint returns ALL metadata needed by the frontend (currency, branding, etc.) — public pages can't call authenticated endpoints for this data.

3. On the frontend, add the method to `publicAPI` or `qrcodeAPI` in `api.js`.

4. Add the frontend route OUTSIDE the `<ProtectedRoute>` wrapper in `App.jsx`:
   ```jsx
   <Route path="/public-page/:param" element={<PublicPage />} />
   ```

---

## Skill 13: Booking Status Transition Guard

**When**: Adding logic that depends on booking status.

### Valid Transitions
```
CREATED → CONFIRMED → CHECKED_IN → CHECKED_OUT
CREATED → CANCELLED
CONFIRMED → CANCELLED
CONFIRMED → NO_SHOW
CHECKED_OUT → REFUNDED (via credit note)
```

### Backend Guard Template
```javascript
const VALID_TRANSITIONS = {
  'CREATED': ['CONFIRMED', 'CANCELLED'],
  'CONFIRMED': ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  'CHECKED_IN': ['CHECKED_OUT'],
  'CHECKED_OUT': ['REFUNDED'],
};

if (!VALID_TRANSITIONS[currentStatus]?.includes(newStatus)) {
  throw new Error(`Cannot transition from ${currentStatus} to ${newStatus}`);
}
```

### Rules
- Never allow cancellation of `CHECKED_IN` bookings (must check out first)
- Billing engine must return 0 for `CANCELLED` bookings
- Check-out must block if pending/in-progress SRs exist

---

## Skill 14: Add Hotel-Scoped Feature with Quota Enforcement

**When**: A new resource should respect hotel quota limits.

### Steps

1. **Add policy limit** in `schema.sql` and `database.js`:
   ```sql
   INSERT INTO policy_limits (key, name, description, default_max_value, scope)
   VALUES ('max_module_items', 'Max Module Items', 'Maximum items per hotel', 100, 'HOTEL')
   ON CONFLICT (key) DO NOTHING;
   ```

2. **Add quota middleware** to the creation route:
   ```javascript
   const { checkQuota } = require('../../../middleware/quota.middleware');
   router.post('/', authMiddleware, requirePermission('MODULE_CREATE'), checkQuota('module_items'), controller.create);
   ```

3. **Increment usage counter** in the service after successful creation:
   ```javascript
   await client.query(
     `INSERT INTO usage_counters (hotel_id, counter_key, current_value)
      VALUES ($1, 'module_items', 1)
      ON CONFLICT (hotel_id, counter_key)
      DO UPDATE SET current_value = usage_counters.current_value + 1`,
     [hotelId]
   );
   ```

4. **Decrement on delete**:
   ```javascript
   await client.query(
     `UPDATE usage_counters SET current_value = GREATEST(current_value - 1, 0)
      WHERE hotel_id = $1 AND counter_key = 'module_items'`,
     [hotelId]
   );
   ```
