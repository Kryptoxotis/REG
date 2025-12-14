# REG Dashboard - Future Development Tasks

## Schedule System Enhancement (Phase 2)

The Schedule system should eventually work as a full employee scheduling platform. **DO NOT BUILD YET** - this is documentation for future implementation.

### Employee Scheduling Flow

**For Employees:**

1. **Open Date System**
   - Admin sets an "open date" when scheduling becomes available for a given period
   - Employees cannot self-schedule until the admin opens scheduling
   - System should show countdown or "scheduling opens on [date]"

2. **Calendar View**
   - When scheduling is open, employees log in and see a calendar view
   - Click on a day to see available Model Homes (Properties where Status = "Model Home")
   - Available time slots shown for each Model Home

3. **Self-Assignment**
   - Employees can only add themselves (system knows who's logged in via auth)
   - Cannot assign other employees to slots
   - Real-time updates to prevent double-booking

4. **Rules & Constraints**
   - **Minimum**: 3 days per week
   - **Maximum**: 5 days per week
   - First come, first served basis
   - Cannot exceed weekly limits
   - System should warn when approaching limits

5. **Submission**
   - Employees submit their selections
   - Submission locks their schedule for admin review
   - Can edit until final deadline (set by admin)

### Admin Scheduling Flow

**For Admins:**

1. **Schedule Management**
   - See all submitted schedules in one dashboard view
   - View by: day, week, month, or by employee
   - Filter by Model Home location

2. **Approval Workflow**
   - Approve submitted schedules
   - Deny with reason (sends notification to employee)
   - Suggest changes (employee must acknowledge)

3. **Manual Override**
   - Can manually assign employees to any slot
   - Override rules when necessary (emergency coverage)
   - Add notes/comments to assignments

4. **Open/Close Scheduling**
   - Set open date for when employees can start self-scheduling
   - Set deadline for schedule submissions
   - Lock schedules after deadline

### Technical Requirements

- Real-time updates (consider WebSocket or polling)
- Conflict detection (no double-booking)
- Email notifications for schedule changes
- Mobile-responsive calendar view
- Export to PDF/CSV for managers

### Database Schema Considerations

May need additional Notion databases or fields:
- Schedule Periods (open date, close date, status)
- Schedule Submissions (employee, date submitted, status: pending/approved/denied)
- Schedule Rules (min/max days, which employees can schedule where)

### UI/UX Notes

- Use color coding for status (open slot = green, assigned = blue, pending approval = amber)
- Show employee photos/avatars on assigned slots
- Quick-view employee weekly summary
- Mobile-first design for employees checking schedules on phones

---

## Other Pending Tasks

### Clickable Relations
- When viewing Team Member details, make deal addresses clickable
- Clicking should navigate to the corresponding Pipeline or Properties record
- Works for any relation field that references another database

### Data Integrity
- Add validation for required fields on Notion updates
- Consider adding undo functionality for accidental changes

---

*Last updated: December 2024*
