export const mutableRef = value => ({ value })

export const read = ({ value }) => value

export const write = (ref, value) => {
	ref.value = value
}
