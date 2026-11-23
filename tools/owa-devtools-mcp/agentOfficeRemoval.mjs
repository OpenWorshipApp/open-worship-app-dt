// Whether an `owa_office_edit` call takes a line, a slide, a box (a
// picture, a text box) or a table's row or column out of a PowerPoint or
// Word file: what the
// firewall's removal budget counts (2026-11-20). A leaf of its own so the
// firewall loads nothing of the tool.

/** Does this call take a line, a slide or a box out? */
export function checkIsOfficeRemoval(args) {
  return (
    args?.action === 'edit' &&
    Array.isArray(args?.changes) &&
    args.changes.some((change) => {
      return (
        change?.remove === true ||
        change?.removeSlide === true ||
        typeof change?.removeRow === 'number' ||
        typeof change?.removeColumn === 'number' ||
        (typeof change?.removeBox === 'string' && change.removeBox !== '')
      );
    })
  );
}
