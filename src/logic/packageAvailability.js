
const ALL_ROOM_IDS = ["Room1", "Room2", "Room3", "Room4"];

// Pond View Cottage is excluded from this package.
const VILLA_WITHOUT_COTTAGE_IDS = ["Room1", "Room2", "Room3"];

export function getAvailablePackages(availableRoomIds) {
  if (!Array.isArray(availableRoomIds)) {
    return [];
  }

  const allRoomsAvailable = ALL_ROOM_IDS.every((id) =>
    availableRoomIds.includes(id)
  );

  const villaWithoutCottageAvailable =
    VILLA_WITHOUT_COTTAGE_IDS.every((id) =>
      availableRoomIds.includes(id)
    );

  const packages = [];

  if (allRoomsAvailable) {
    packages.push({
      id: "FullVilla",
      number: "01",
      shortName: "Full Villa",
      name: "Full Villa",
      tagline: "The complete SU VILLA experience.",
      description:
        "Enjoy the entire villa, including all four rooms and the Pond View Cottage.",
      image: "/images/packages/package1.jpg",
      highlights: [
        "All 4 Rooms",
        "Pond View Cottage Included",
        "Breakfast Included",
      ],
    });
  }

  if (villaWithoutCottageAvailable) {
    packages.push({
      id: "VillaWithoutCottage",
      number: "02",
      shortName: "Without Cottage",
      name: "Villa without Cottage",
      tagline: "A private villa stay without the cottage.",
      description:
        "Enjoy the villa with three rooms, excluding the Pond View Cottage.",
      image: "/images/packages/package2.jpg",
      highlights: [
        "3 Rooms",
        "Pond View Cottage Excluded",
        "Breakfast Included",
      ],
    });
  }

  return packages;
}
