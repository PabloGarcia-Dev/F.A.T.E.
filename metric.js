/* Calculate days remaining until expiration */
export function getDaysLeft(expiryDate) {
  const today = new Date();
  const expiry = new Date(`${expiryDate}T00:00:00`);

  today.setHours(0, 0, 0, 0);

  return Math.ceil((expiry - today) / 86400000);
}

/* Return the number of pantry items */
export function getTotalItems(items) {
  return items.length;
}

/* Return an expiration category for styling */
export function getExpirationStatus(expiryDate) {
  const daysLeft = getDaysLeft(expiryDate);

  if (daysLeft < 0) {
    return "expired";
  }

  if (daysLeft <= 2) {
    return "critical";
  }

  if (daysLeft <= 5) {
    return "warning";
  }

  if (daysLeft <= 7) {
    return "attention";
  }

  return "fresh";
}

/* Return readable expiration text */
export function getExpirationMessage(expiryDate) {
  const daysLeft = getDaysLeft(expiryDate);

  if (daysLeft < 0) {
    return `Expired ${Math.abs(daysLeft)} days ago`;
  }

  if (daysLeft === 0) {
    return "Expires today";
  }

  if (daysLeft === 1) {
    return "Expires tomorrow";
  }

  return `${daysLeft} days left`;
}

/* Return items sorted from closest expiration to furthest */
export function getItemsSortedByExpiry(items) {
  return [...items].sort((firstItem, secondItem) => {
    return (
      new Date(firstItem.expiryDate) -
      new Date(secondItem.expiryDate)
    );
  });
}

/* Return the number of expired items */
export function getExpiredCount(items) {
  return items.filter((item) => {
    return getDaysLeft(item.expiryDate) < 0;
  }).length;
}

/* Return the number of items expiring soon */
export function getExpiringSoonCount(items, numberOfDays = 3) {
  return items.filter((item) => {
    const daysLeft = getDaysLeft(item.expiryDate);

    return daysLeft >= 0 && daysLeft <= numberOfDays;
  }).length;
}

/* Return copies of the items with daysLeft added */
export function getItemsWithDaysLeft(items) {
  return items.map((item) => {
    return {
      ...item,
      daysLeft: getDaysLeft(item.expiryDate)
    };
  });
}

/* Count items by Eco-Score */
export function getEcoScoreCounts(items) {
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

/* Return dashboard metrics together */
export function getPantryMetrics(items) {
  return {
    totalItems: getTotalItems(items),
    expiredItems: getExpiredCount(items),
    expiringSoon: getExpiringSoonCount(items),
    ecoScoreCounts: getEcoScoreCounts(items)
  };
}