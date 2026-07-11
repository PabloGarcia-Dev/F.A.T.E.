/* Calculate days remaining until expiration */
function getDaysLeft(expiryDate) {
  const today = new Date();
  const expiry = new Date(`${expiryDate}T00:00:00`);

  today.setHours(0, 0, 0, 0);

  return Math.ceil((expiry - today) / 86400000);
}

/* Number of items in the pantry */
function getTotalItems(items) {
  return items.length;
}

/* Number of expired items */
function getExpiredCount(items) {
  return items.filter((item) => {
    return getDaysLeft(item.expiryDate) < 0;
  }).length;
}

/* Number of items expiring within a specified number of days */
function getExpiringSoonCount(items, numberOfDays = 3) {
  return items.filter((item) => {
    const daysLeft = getDaysLeft(item.expiryDate);

    return daysLeft >= 0 && daysLeft <= numberOfDays;
  }).length;
}

/* Return items sorted by expiration date */
function getItemsSortedByExpiry(items) {
  return [...items].sort((firstItem, secondItem) => {
    return (
      new Date(firstItem.expiryDate) -
      new Date(secondItem.expiryDate)
    );
  });
}

/* Add a calculated daysLeft field to each returned item */
function getItemsWithDaysLeft(items) {
  return items.map((item) => {
    return {
      ...item,
      daysLeft: getDaysLeft(item.expiryDate)
    };
  });
}

/* Count items by Eco-Score */
function getEcoScoreCounts(items) {
  const counts = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    unknown: 0
  };

  items.forEach((item) => {
    const score = item.ecoScore?.toUpperCase();

    if (counts[score] !== undefined) {
      counts[score]++;
    } else {
      counts.unknown++;
    }
  });

  return counts;
}

/* Return every metric in one object */
function getPantryMetrics(items) {
  return {
    totalItems: getTotalItems(items),
    expiredItems: getExpiredCount(items),
    expiringSoon: getExpiringSoonCount(items),
    ecoScoreCounts: getEcoScoreCounts(items)
  };
}
