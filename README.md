# Employee Crew Cost Calculator

A standalone browser page that replaces classification quantities with named employees. It uses the supplied `429 Contract Input`, `Labor Details`, and `Crew Calc` formulas and a snapshot of the Google Sheet `Employee List`.

## Use

Open `index.html` in a current browser. Select employees, choose a pay type, and add them to the crew. The calculator shows paid wages, taxes and insurance, benefits, total burden, and total crew cost per hour.

Use **New special classification** to combine a wage source with a different benefit package. For example, an AP1 wage can be paired with CW1 benefits. A custom hourly wage can also be paired with any contract benefit package.

Use **Edit rates & employees** to update the contract assumptions that correspond to the 429 Contract Input worksheet. The Employees section in the same dialog adds or removes employee names and sets each employee's default classification. Changing a crew member's classification also updates that employee's default for the next crew.

Rate changes, the editable employee roster, default classifications, special classifications, and the current crew are saved in browser storage on the current device. Settings exports include the employee roster and can be imported from JSON for sharing or backup. Older settings exports remain supported and leave the current employee roster in place.

## Source assumptions

- Opening agreement: IBEW Local Union #429, effective 1/1/23 through 5/31/23.
- Standard classifications are the populated headings in `Labor Details!E4:V4`; blank column H is excluded.
- The opening roster contains 39 employees from the Google Sheet `Employee List`; it can be maintained in the browser after opening the calculator.
- Roster classifications `F` and `AP` are intentionally left unresolved because the source does not confirm that `F` means `FOR` or which apprentice level `AP` means. Select a cost classification for those employees when adding them to a crew.
- Second- and third-shift calculations preserve the workbook formulas: `(base × 1.10 × 8) ÷ 7.5` and `(base × 1.15 × 8) ÷ 7` respectively.
- The supplied premium formulas apply the 10% apprentice pension to AP6/AP5 premium wages but omit it for AP4/AP3, even though straight-time pension covers AP3–AP6. The calculator preserves those displayed workbook totals until the agreement rule is confirmed.
- The `Master Truck Fee` input is not shown because no `Labor Details` or `Crew Calc` formula references it.
- Overhead and profit are optional pricing calculations and do not change displayed crew cost.

## Verification

Run the calculation characterization checks with:

```powershell
node --test tests/calculator.test.js
```

The checks compare all 17 standard classifications across all five pay types with the totals displayed in the supplied `Labor Details` worksheet.
