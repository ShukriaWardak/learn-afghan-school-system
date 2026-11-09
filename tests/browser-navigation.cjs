// Follow the same expandable sidebar controls that a user operates.
module.exports=async function navigate(page,target){
  const button=page.locator('#nav [data-page="'+target+'"]');
  const collapsed=await button.evaluate(element=>{
    const group=element.closest('details');
    return Boolean(group&&!group.open);
  });
  if(collapsed)await page.locator('#nav .ref-more-menu > summary').click();
  await button.click();
};
