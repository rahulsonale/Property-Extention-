(() => {
  const input = document.querySelector('#pageClickstreamObject');

  if (!input) {
    console.warn('[Property Search Assistant] Property data was not found.');
    return;
  }

  try {
    const pageData = JSON.parse(input.value);
    const projectId = location.pathname.match(/r(\d+)/)?.[1];

    const project = pageData.find(
      (item) =>
        item.entityType === 'PROJECT' &&
        String(item.projectUnitId) === projectId &&
        item.configSummary?.tuples?.length,
    );

    if (!project) {
      console.warn('[Property Search Assistant] No project record matched this page.', {
        projectId,
      });
      return;
    }

    const data = {
      website: '99acres',
      propertyName: project.name,
      projectId: project.projectUnitId,
      url: location.href,
      configurations: project.configSummary.tuples.map((unit) => {
        const priceFor = (category) => {
          const price = unit.categorySummary?.[category]?.price;
          return price
            ? {
                display: price.valueLabel ?? null,
                min: price.min ?? null,
                max: price.max ?? null,
              }
            : null;
        };

        return {
          configuration: [unit.bedrooms?.label, unit.propertyType?.label].filter(Boolean).join(' '),
          area: unit.area?.display ?? null,
          areaType: unit.area?.type?.label ?? null,
          prices: {
            newBooking: priceFor('newBooking'),
            resale: priceFor('resale'),
            rental: priceFor('rental'),
          },
        };
      }),
    };

    console.log('[Property Search Assistant] Extracted property data:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[Property Search Assistant] Could not read property data:', error);
  }
})();
