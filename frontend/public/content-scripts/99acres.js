(() => {
  const projectId = location.pathname.match(/r(\d+)/)?.[1];
  let attempts = 0;

  const timer = setInterval(() => {
    attempts += 1;

    const input = document.querySelector('#pageClickstreamObject');

    if (input?.value) {
      try {
        const pageData = JSON.parse(input.value);

        const project = pageData.find(
          (item) =>
            item.entityType === 'PROJECT' &&
            String(item.projectUnitId) === projectId &&
            item.configSummary?.tuples?.length,
        );

        if (project) {
          clearInterval(timer);

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
                configuration: [unit.bedrooms?.label, unit.propertyType?.label]
                  .filter(Boolean)
                  .join(' '),
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
          return;
        }
      } catch {
        // The page may still be filling in the data; try again.
      }
    }

    if (attempts >= 60) {
      clearInterval(timer);
      console.warn("[Property Search Assistant] Timed out waiting for this page's project data.");
    }
  }, 500);
})();
