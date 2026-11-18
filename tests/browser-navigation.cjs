// Follow the visible navigation, including the reference layout's collapsed modules.
async function openModule(page,key) {
 const link=page.locator('[data-page="'+key+'"]');
 await link.waitFor({state:'attached'});
 if (!(await link.isVisible())) {
  const group=page.locator('.ref-more-menu');
  if (await group.count() && !(await group.evaluate(el=>el.open))) await group.locator('summary').click();
 }
 await link.click();
}
module.exports={openModule};
