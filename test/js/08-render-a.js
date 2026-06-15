function cardClass(type) {
  return type === 'watts' ? 'card card-watts' :
         type === 'units' ? 'card card-units' :
         type === 'env'   ? 'card card-env'   : 'card';
}
