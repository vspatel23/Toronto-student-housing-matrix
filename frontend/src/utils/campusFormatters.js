export const getCampusLabel = (campus) => {
  const institution = campus?.institution?.trim();
  const campusName = campus?.campusName?.trim();

  if (institution && campusName && institution === campusName) {
    return institution;
  }

  if (institution && campusName) {
    return `${institution} -- ${campusName}`;
  }

  return institution || campusName || "Unnamed campus";
};
